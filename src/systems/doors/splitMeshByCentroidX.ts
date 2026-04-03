import { BufferAttribute, BufferGeometry } from 'three'

/**
 * Split a mesh into left / right parts by triangle centroid sign in local X.
 * Duplicates vertices (no welding) — fine for static door leaves.
 */
export function splitIndexedMeshByCentroidX(geom: BufferGeometry): {
  left: BufferGeometry
  right: BufferGeometry
} {
  const pos = geom.attributes.position as BufferAttribute
  const nor = geom.attributes.normal as BufferAttribute | undefined
  const uv = geom.attributes.uv as BufferAttribute | undefined
  const idx = geom.index
  if (!idx) {
    return splitNonIndexedMeshByCentroidX(geom)
  }

  const iArr = idx.array as Uint16Array | Uint32Array
  const nTri = idx.count / 3
  const leftTri: number[] = []
  const rightTri: number[] = []

  for (let t = 0; t < nTri; t++) {
    const ia = iArr[t * 3]!
    const ib = iArr[t * 3 + 1]!
    const ic = iArr[t * 3 + 2]!
    const ax = pos.getX(ia)
    const bx = pos.getX(ib)
    const cx = pos.getX(ic)
    const cent = (ax + bx + cx) / 3
    const bucket = cent < 0 ? leftTri : rightTri
    bucket.push(ia, ib, ic)
  }

  return {
    left: buildSubGeometry(pos, nor, uv, leftTri),
    right: buildSubGeometry(pos, nor, uv, rightTri),
  }
}

function splitNonIndexedMeshByCentroidX(geom: BufferGeometry): {
  left: BufferGeometry
  right: BufferGeometry
} {
  const pos = geom.attributes.position as BufferAttribute
  const nor = geom.attributes.normal as BufferAttribute | undefined
  const uv = geom.attributes.uv as BufferAttribute | undefined
  const nTri = pos.count / 3
  const leftTri: number[] = []
  const rightTri: number[] = []
  for (let t = 0; t < nTri; t++) {
    const ia = t * 3
    const ib = t * 3 + 1
    const ic = t * 3 + 2
    const ax = pos.getX(ia)
    const bx = pos.getX(ib)
    const cx = pos.getX(ic)
    const cent = (ax + bx + cx) / 3
    const bucket = cent < 0 ? leftTri : rightTri
    bucket.push(ia, ib, ic)
  }
  return {
    left: buildSubGeometry(pos, nor, uv, leftTri),
    right: buildSubGeometry(pos, nor, uv, rightTri),
  }
}

function buildSubGeometry(
  pos: BufferAttribute,
  nor: BufferAttribute | undefined,
  uv: BufferAttribute | undefined,
  oldIndices: number[],
): BufferGeometry {
  const vCount = oldIndices.length
  const pArr = new Float32Array(vCount * 3)
  const nArr = nor ? new Float32Array(vCount * 3) : null
  const uvArr = uv ? new Float32Array(vCount * 2) : null

  for (let i = 0; i < vCount; i++) {
    const oi = oldIndices[i]!
    pArr[i * 3] = pos.getX(oi)
    pArr[i * 3 + 1] = pos.getY(oi)
    pArr[i * 3 + 2] = pos.getZ(oi)
    if (nor && nArr) {
      nArr[i * 3] = nor.getX(oi)
      nArr[i * 3 + 1] = nor.getY(oi)
      nArr[i * 3 + 2] = nor.getZ(oi)
    }
    if (uv && uvArr) {
      uvArr[i * 2] = uv.getX(oi)
      uvArr[i * 2 + 1] = uv.getY(oi)
    }
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pArr, 3))
  if (nArr) g.setAttribute('normal', new BufferAttribute(nArr, 3))
  if (uvArr) g.setAttribute('uv', new BufferAttribute(uvArr, 2))
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}
