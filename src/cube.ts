import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

import { PhongObjInfo } from './phongshader'

export class Cube {

	static vtxes(): PhongObjInfo {
		const base_points = [[-1, -1], [-1,  1], [1,  -1], [1, 1]];
		const start_normal = twgl.v3.create(0, 0, -1)

		const rotations = [
	      twgl.m4.identity(),
	      twgl.m4.rotationX(Math.PI),
	      twgl.m4.rotationY(Math.PI / 2),
	      twgl.m4.rotationY(-Math.PI / 2),
	      twgl.m4.rotationX(Math.PI / 2),
	      twgl.m4.rotationX(-Math.PI / 2),
		]

		const translations = [
		  twgl.v3.create( 0,  0, -1),
		  twgl.v3.create( 0,  0,  1),
		  twgl.v3.create(-1,  0,  0),
		  twgl.v3.create( 1,  0,  0),
		  twgl.v3.create( 0,  1,  0),
		  twgl.v3.create( 0, -1,  0),
		]

		let out_points = []
		let out_normals = []
		let out_idxes = []
		let out_colors = []

		const push_point = p => {
			out_points.push(p[0])
			out_points.push(p[1])
			out_points.push(p[2])
			out_points.push(1)
		}

		const push_normal = n => {
			out_normals.push(n[0])
			out_normals.push(n[1])
			out_normals.push(n[2])
			out_normals.push(0)
		}

		const push_color = (r, g, b, a) => {
			out_colors.push(r);
			out_colors.push(g);
			out_colors.push(b);
			out_colors.push(a);
		}

		for (let i = 0; i < 6; i++) {
			const t = twgl.m4.translation(translations[i]);
			const r = rotations[i];
			const tform = twgl.m4.multiply(t, r);
			const n = twgl.m4.transformNormal(tform, start_normal)
			base_points.forEach(b => {
				const o_p = twgl.m4.transformPoint(tform, twgl.v3.create(b[0], b[1], 0))
				push_point(o_p)
				push_normal(n)
			    push_color(i % 2, (i + 1) % 2, i % 3, 1)
			})

			const base_i = i * 4
			out_idxes.push(base_i)
			out_idxes.push(base_i + 1)
			out_idxes.push(base_i + 2)

			out_idxes.push(base_i + 2)
			out_idxes.push(base_i + 1)
			out_idxes.push(base_i + 3)
		}

		let info: PhongObjInfo = new PhongObjInfo();
		info.pts = new Float32Array(out_points);
		info.normals = new Float32Array(out_normals);
		info.idxes = new Uint16Array(out_idxes);
		info.colors = new Float32Array(out_colors);
		info.num_idxes = out_idxes.length;
		return info;
	}

}
