var path = require('path');
var CleanWebpackPlugin = require('clean-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');

// 监听选项
var watchOptions = {
  ignore: ['node_modules', 'pixi']
}

module.exports = {
  mode: 'development',
  entry: {
    polyfill: '@babel/polyfill',
    pixi: [
      './src/script/lib/pixi',
      './src/script/lib/pixi-extra-filters',
      './src/script/lib/gsap/TweenMax'
    ],
    index: './src/script/index'
  },
  output: {
    path: path.resolve('./dist/'),
    filename: './script/[name]-[chunkHash:6].js'
  },
  module: {
    noParse: /pixi|TimelineMax/,
    rules: [
      {
        test: /\.es6$|\.js$/,
        use: [{
          loader: 'babel-loader',
          options: {
            presets: ['@babel/env']
          }
        }],
      },
      {
        test: /\.css$|\.scss$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: ['css-loader']
        })
      },
      {
        test: /\.jpg$|\.jpeg$|\.gif$|\.webp$|\.png$/,
        use: {
          loader: 'file-loader',
          options: {
            name: './images/[name]-[hash:6].[ext]'
          }
        },
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.es6']
  },
  externals: {
    '@pixi': 'PIXI',
    '@pixi-extra-filters': ['PIXI', 'filters'],
    '@gsap/tween-max': 'TweenMax'
  },
  devtool: 'source-map',
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: './src/puzzle.html',
      inject: false
    }),
    new ExtractTextPlugin('style.css')
  ],
  devServer: {
    port: 10086,
    host: 'localhost',
    open: true,
    contentBase: './dist',
    watchOptions: watchOptions
  }
}

