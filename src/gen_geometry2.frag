 #version 300 es

 out uvec4 out_vtx;

 void main() {
 	out_vtx = uvec4(
 		1,
 		floatBitsToUint(gl_FragCoord.x),
 		floatBitsToUint(gl_FragCoord.y), 
 		4);
 }
