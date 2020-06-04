const g = require('gulp')
const through2 = require('through2')
const concat = require('gulp-concat')
const merge = require('merge-stream')
const path = require('path')

const HTML_START_DELIM = '<!doctype html>'
const HTML_END_DELIM = '</html>'
const SHADERS_TEMPLATE = '{{ SHADERS }}'

function embed_shaders_in_html() {

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

  return merge(a, g.src('src/index.html'))
    .pipe(concat('index.html'))
    .pipe(through2.obj(function(file, _, cb) {
      // ewwww :)
      const src = file.contents.toString()
      if (src.startsWith(HTML_START_DELIM)) {
        const shaders = src.split(HTML_END_DELIM)[1]
        const html_template = src.split(HTML_END_DELIM)[0] + HTML_END_DELIM
        file.contents = Buffer.from(html_template.replace(SHADERS_TEMPLATE, shaders))
      } else {
        const shaders = src.split(HTML_START_DELIM)[0]
        const html_template = HTML_START_DELIM + src.split(HTML_START_DELIM)[1]
        file.contents = Buffer.from(html_template.replace(SHADERS_TEMPLATE, shaders))        
      }

      cb(null, file)
    }))
    .pipe(g.dest('dist/'))

}

function copy_styles(cb) {
  g.src('src/*.css').pipe(g.dest('dist/'))
  cb()
}


exports.default = g.parallel(embed_shaders_in_html, copy_styles)