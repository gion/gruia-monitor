module.exports = {
    entry: './src/index.js',
    output: {
        filename: './public/bundle.js'
    },
    devtool: 'source-map',
    module: {
        loaders: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                query: {
                    presets: [
                        'es2015',
                        'stage-0'
                    ]
                }
            }
        ]
    }
};