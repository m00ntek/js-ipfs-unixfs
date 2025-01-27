import dirBuilder from './dir.js'
import fileBuilder from './file/index.js'
import errCode from 'err-code'
import rabin from '../chunker/rabin.js'
import fixedSize from '../chunker/fixed-size.js'
import validateChunks from './validate-chunks.js'

/**
 * @typedef {import('../types').File} File
 * @typedef {import('../types').Directory} Directory
 * @typedef {import('../types').DAGBuilder} DAGBuilder
 * @typedef {import('../types').Chunker} Chunker
 * @typedef {import('../types').ChunkValidator} ChunkValidator
 */

/**
 * @param {any} thing
 * @returns {thing is Iterable<any>}
 */
function isIterable (thing) {
  return Symbol.iterator in thing
}

/**
 * @param {any} thing
 * @returns {thing is AsyncIterable<any>}
 */
function isAsyncIterable (thing) {
  return Symbol.asyncIterator in thing
}

/**
 * @param {Uint8Array | AsyncIterable<Uint8Array> | Iterable<Uint8Array>} content
 * @returns {AsyncIterable<Uint8Array>}
 */
function contentAsAsyncIterable (content) {
  try {
    if (content instanceof Uint8Array) {
      return (async function * () {
        yield content
      }())
    } else if (isIterable(content)) {
      return (async function * () {
        yield * content
      }())
    } else if (isAsyncIterable(content)) {
      return content
    }
  } catch {
    throw errCode(new Error('Content was invalid'), 'ERR_INVALID_CONTENT')
  }

  throw errCode(new Error('Content was invalid'), 'ERR_INVALID_CONTENT')
}

/**
 * @type {DAGBuilder}
 */
async function * dagBuilder (source, blockstore, options) {
  for await (const entry of source) {
    if (entry.path) {
      if (entry.path.substring(0, 2) === './') {
        options.wrapWithDirectory = true
      }

      entry.path = entry.path
        .split('/')
        .filter(path => path && path !== '.')
        .join('/')
    }

    if (entry.content) {
      /**
       * @type {Chunker}
       */
      let chunker

      if (typeof options.chunker === 'function') {
        chunker = options.chunker
      } else if (options.chunker === 'rabin') {
        chunker = rabin
      } else {
        chunker = fixedSize
      }

      /**
       * @type {ChunkValidator}
       */
      let chunkValidator

      if (typeof options.chunkValidator === 'function') {
        chunkValidator = options.chunkValidator
      } else {
        chunkValidator = validateChunks
      }

      /** @type {File} */
      const file = {
        path: entry.path,
        mtime: entry.mtime,
        mode: entry.mode,
        content: chunker(chunkValidator(contentAsAsyncIterable(entry.content), options), options)
      }

      yield () => fileBuilder(file, blockstore, options)
    } else if (entry.path) {
      /** @type {Directory} */
      const dir = {
        path: entry.path,
        mtime: entry.mtime,
        mode: entry.mode
      }

      yield () => dirBuilder(dir, blockstore, options)
    } else {
      throw new Error('Import candidate must have content or path or both')
    }
  }
}

export default dagBuilder
