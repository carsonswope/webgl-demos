export class GlCtx {

  gl: WebGL2RenderingContext;

  public constructor() {

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2' /*, { antialias: false } */)
    if (!gl) { 
      alert('WebGL2 not enabled for your browser!')
      return;
    }

    const ext_names = ['EXT_float_blend', 'OES_texture_float_linear'];
    ext_names.forEach(e => {
      const ext = gl.getExtension(e);
      if (ext == null) { alert(`Required WebGL2 extension ${e} not available`) }
    });

    const debug_info = gl.getExtension('WEBGL_debug_renderer_info');
    let renderer_info = debug_info != null 
        ? gl.getParameter(debug_info.UNMASKED_RENDERER_WEBGL) 
        : 'Unknown';

    document.getElementById('gpu').getElementsByTagName('span')[0].innerText =
        renderer_info;

    gl.enable(gl.DEPTH_TEST)

    this.gl = gl;
  }

  public canvas(): HTMLCanvasElement {
    return this.gl.canvas as HTMLCanvasElement;
  }
}
