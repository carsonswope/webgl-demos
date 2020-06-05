import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

import { PhongObjInfo } from './phongshader'

export class Terrain1 {
	
	static make(): PhongObjInfo {
		const base_points = [[-1, -1], [-1,  1], [1,  -1], [1, 1]];
		const start_normal = twgl.v3.create(0, 0, -1)

		const a = 3
		const b = 0
		const c = 1
		const g_fn = (x: number): number => {
			const pwr = -Math.pow(x - b, 2.)/(2 * Math.pow(c, 2));
			return a * Math.pow(Math.E, pwr);
		}

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

		const dim_x = 150;
		const dim_y = 150;

		const scale_x = 20.;
		const scale_y = 20.;

		const mult2 = 8;

		for (let i =0; i < dim_x; i++) {

			// -0.5 to 0.5
			const norm_i = (i / (dim_x - 1.)) - 0.25;

			for (let j =0; j < dim_y; j++) {
				const norm_j = (j / (dim_y - 1.)) - 0.25;
				const norm_dist = Math.sqrt((norm_i * norm_i) + (norm_j * norm_j))
				const fn_res = g_fn(norm_dist * mult2);

				const DELTA = 0.01;
				
				//slope!
				let d_fn_res = (g_fn((norm_dist * mult2) + DELTA) - fn_res) / DELTA;

				let n;
				const zero = 0.000001
				if (d_fn_res < zero && d_fn_res > -zero) {
					n = twgl.v3.create(0, 1, 0)
				} else {
					n = twgl.v3.normalize(twgl.v3.create(1, -1 / d_fn_res, 0))
				}

				const th = Math.atan2(norm_j, norm_i);

				const n2= twgl.m4.transformPoint(twgl.m4.rotationY(-th), n);


				push_point([scale_x * norm_i, fn_res, scale_y * norm_j])
				push_normal(n2)
				push_color(0, 0.8, 0.2, 1)

				if (i < dim_x -1 && j < dim_y -1) {
					out_idxes.push(j * dim_x + i)
					out_idxes.push(j * dim_x + i + 1)
					out_idxes.push((j + 1) * dim_x + i)

					out_idxes.push(j * dim_x + i + 1)
					out_idxes.push((j + 1) * dim_x + i)
					out_idxes.push((j + 1) * dim_x + i + 1)
				}
			}
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