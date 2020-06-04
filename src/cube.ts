export class Cube {
	static vtxes(): Float32Array {
		return new Float32Array([
		  -1, -1, -1, 1,
		   1, -1, -1, 1,
		  -1,  1, -1, 1,
		   1,  1, -1, 1,
		  -1, -1,  1, 1,
		   1, -1,  1, 1,
		  -1,  1,  1, 1,
		   1,  1,  1, 1
		])
	}

	static idxes(): Uint16Array {
		  return new Uint16Array([
		    0, 1, 2,
		    2, 1, 3,
		    0, 4, 2,
		    2, 4, 6,
		    1, 5, 3,
		    3, 5, 7,
		    2, 3, 6,
		    3, 6, 7,
		    0, 4, 1,
		    1, 4, 5,
		    4, 5, 6,
		    6, 5, 7
		  ]);
	}
}
