/**
 * @typedef {import('../../../types').ExporterOptions} ExporterOptions
 * @typedef {import('../../../types').UnixfsV1DirectoryContent} UnixfsV1DirectoryContent
 * @typedef {import('../../../types').UnixfsV1Resolver} UnixfsV1Resolver
 */

/**
 * @type {UnixfsV1Resolver}
 */
const directoryContent = (cid, node, unixfs, path, resolve, depth, blockstore) => {
  /**
   * @param {ExporterOptions} [options]
   * @returns {UnixfsV1DirectoryContent}
   */
  async function * yieldDirectoryContent (options = {}) {
    const offset = options.offset || 0
    const length = options.length || node.Links.length
    const links = node.Links.slice(offset, length)

    for (const link of links) {
      const result = await resolve(link.Hash, link.Name || '', `${path}/${link.Name || ''}`, [], depth + 1, blockstore, options)

      if (result.entry) {
        yield result.entry
      }
    }
  }

  return yieldDirectoryContent
}

export default directoryContent
