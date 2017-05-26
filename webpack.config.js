var outputPath = process.env.NODE_ENV === 'production' ? 'build' : 'public';

module.exports = {
    entry: './src/index.js',
    output: {
        filename: './' + outputPath + '/bundle.js'
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