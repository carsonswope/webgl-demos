const path = require('path')

module.exports = {
	entry: './dist/main.js',
	mode: 'production',
	// mode: 'development',
	output: {
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'dist')
	}
}