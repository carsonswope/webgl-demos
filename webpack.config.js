const path = require('path')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = env => {

	var prod = env && env.production
	var mode = prod ? 'production' : 'development';

	var cfg = {
		entry: './dist/main.js',
		mode: mode,
		output: {
			filename: 'bundle.js',
			path: path.resolve(__dirname, 'dist')
		}
	}

	if (prod) {
		cfg.optimization = {minimizer: [new UglifyJsPlugin({uglifyOptions: { output: {comments: false} }})]}
	}

	return cfg;
}