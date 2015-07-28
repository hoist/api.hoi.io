'use strict';
var gulp = require('gulp');
var exec = require('child_process').exec;
var loadPlugins = require('gulp-load-plugins');
var globs = require('../globs');

var plugins = loadPlugins();

gulp.task('esdoc', ['clean-docs'], function (cb) {
  exec('./node_modules/.bin/esdoc -c esdoc.json', function (err, stdout, stderr) {
    if (stderr) {
      console.log('stderr:', stderr);
    }
    if (stdout) {
      console.log('stdout:', stdout);
    }
    cb(err);
  });
});

gulp.task('concat-api-docs', function () {
  return gulp.src(globs.docs)
    .pipe(plugins.concat('apiary.apib'))
    .pipe(gulp.dest('./'));
});

gulp.task('api-docs', ['api-docs-raw', 'api-docs-multi']);
gulp.task('api-docs-raw', ['concat-api-docs'], function () {
  return gulp.src(globs.docs)
    .pipe(plugins.aglio({
      template: 'flatly'
    }))
    .pipe(gulp.dest('./docs'));
});

gulp.task('api-docs-multi', ['concat-api-docs'], function () {
  return gulp.src('apiary.apib')
    .pipe(plugins.aglio({
      template: 'flatly-multi'
    }))
    .pipe(plugins.concat('index.html'))
    .pipe(gulp.dest('./docs'));
});
