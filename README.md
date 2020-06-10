# WebGL2 random terrain generator

This is a WebGL2 implementation of a random terrain generation technique explained in [Nvidia GPU Gems](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-1-generating-complex-procedural-terrains-using-gpu).

Check it out [live](https://www.googe.com)

## Local development

This is a very simple npm-based appp. With webpack/gulp/typescript, everything is reduced to a single index.html entry point that loads a small stylesheet and a JS script that runs the demo. To build it locally, just run:

```
npm i
npm run watch-build
```

And then open `./dist/index.html` in your web browser of choice.

While the watch/build command is running, any time you change a file everything will be recompiled and you can see your changes by refreshing the page.

## WebGL2 challenges

There are a number of features that are available in OpenGL / DirectX that aren't available in WebGL2

- The terrain generation pipeline uses the marching cubes algorithm to generate geometry by sampling voxels in blocks of 32x32x32 voxels. The marching cubes algorithm emits 0-5 triangles per voxel. With a modern low-level graphics API, this can be easily implemented in a geometry shader, which can emit geometry information of variable length, or a compute shader. Both of those shader program types are unfortunately not available in WebGL2, so an nlog(n) implementation of prefix-scan via a vertex+fragment shader program is used instead to compress the output data into a dense vertex buffer that can be rendered more efficiently and take up less memory

- The pipeline also relies on linear filtering of a 3D texture of floating point values. This feature requires using the `EXT_float_blend` and `OES_texture_float_linear` extensions, which may not be available on all browsers.
