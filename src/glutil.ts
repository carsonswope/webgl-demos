export class TexFormat {
  internal_format: number;
  format: number;
  type: number;

  public constructor(i_f: number, f: number, t:number) {
  	this.internal_format = i_f;
  	this.format = f;
  	this.type = t;
  }
}

export class GlUtil {
  public static init_tex(gl: WebGL2RenderingContext): WebGLTexture {
    const t = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t
  }

  public static tex_img_2d(
      gl: WebGL2RenderingContext,
      tex: WebGLTexture, 
      f: TexFormat,
      x: number, 
      y: number, 
      d = null) {

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D, 
      0, 
      f.internal_format, 
      x, 
      y, 
      0, 
      f.format, 
      f.type, 
      d)
    gl.bindTexture(gl.TEXTURE_2D, null);    
  }
}
