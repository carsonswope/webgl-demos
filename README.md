# WebGL2 random terrain generator

This is a WebGL2 implementation of a random terrain generation technique explained in [Nvidia GPU Gems](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-1-generating-complex-procedural-terrains-using-gpu).

Check it out [live](https://carsonswope.github.io/webgl-demos/docs/index.html)

## Local development

This is a very simple npm-based appp. With webpack/gulp/typescript, everything is reduced to a single index.html entry point that loads a small stylesheet and a JS script that runs the demo. To build it locally, just run:

```
npm i
npm run watch-build
```

And then open `./dist/index.html` in your web browser of choice.

While the watch/build command is running, any time you change a file everything will be recompiled and you can see your changes by refreshing the page.

To make a 'minified' build, run `npm run build-prod`. This runs the 'production' mode build, only once with no file watching.

Finally, run `npm run publish` to run the production build and then copy the important files into ./docs, so that they can be served via github pages 

## WebGL2 challenges

There are a number of features that are available in OpenGL / DirectX that aren't available in WebGL2

- The terrain generation pipeline uses the marching cubes algorithm to generate geometry by sampling voxels in blocks of 32x32x32 voxels. The marching cubes algorithm emits 0-5 triangles per voxel. A simple parallel implementation will emit the triangles in a sparse grid, which drastically increses memory requirements and cost for subsequent rendering operations (this is not an uncommon type of problem in parallel computing). The vertex information could be easily generated densely via either a geometry shader or a compute shader, both of which are unfortunately not available in WebGL2. Instead, after determining how many triangles are emitted by each voxel, a prefix-scan algorithm implemented with vertex+fragment shader programs is used before generating the actual geometry. 

- The pipeline also relies on linear filtering of a 3D texture of floating point values. This feature requires enabling the `EXT_float_blend` and `OES_texture_float_linear` extensions, which may not be available on all browsers.
