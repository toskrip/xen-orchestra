import { createReadableSparseStream } from 'vhd-lib'

import VMDKDirectParser from './vmdk-read'
import readVmdkGrainTable from './vmdk-read-table'
import { parseOVAFile, ParsableFile } from './ova'

async function vmdkToVhd(vmdkReadStream, table) {
  const parser = new VMDKDirectParser(vmdkReadStream)
  const header = await parser.readHeader()
  return createReadableSparseStream(
    header.capacitySectors * 512,
    header.grainSizeSectors * 512,
    table,
    parser.blockIterator()
  )
}

export { ParsableFile, parseOVAFile, vmdkToVhd, readVmdkGrainTable }
