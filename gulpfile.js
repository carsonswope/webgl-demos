 var g = require('gulp')
 var through2 = require('through2')
 const concat = require('gulp-concat')
const merge = require('merge-stream')
 const path = require('path')

function make_index(cb) {
	g.src('src/index.html').pipe(g.dest('dist/'))
	cb()
}

const HTML_DELIM = '<!doctype html>'
const SHADERS_TEMPLATE = '{{ SHADERS }}'

function copy_shaders() {

	const a = g.src('src/**/*.vert').pipe(g.src('src/**/*.frag'))
		.pipe(through2.obj(function(file, _, cb) {
			  const src = file.contents.toString()
        const new_src = `<script id="${path.basename(file.path).replace('.', '_')}" type="notjs">\n${src}\n</script>`
        file.contents = Buffer.from(new_src)
        cb(null, file)}))
    .pipe(concat('shaders.html.template'))
    .pipe(through2.obj(function(file, _, cb) {
        const src = file.contents.toString()
        cb(null, file)
    }))
  // const b = g.src('src/index.html')

  return merge(a, g.src('src/index.html'))
    .pipe(concat('index.html'))
    .pipe(through2.obj(function(file, _, cb) {
      // ewwww :)
      const src = file.contents.toString()
      const shaders = src.split(HTML_DELIM)[0]
      const html_template = HTML_DELIM + src.split(HTML_DELIM)[1]
      file.contents = Buffer.from(html_template.replace(SHADERS_TEMPLATE, shaders))
      cb(null, file)
    }))
    .pipe(g.dest('dist/'))

}


exports.default = g.series(copy_shaders)