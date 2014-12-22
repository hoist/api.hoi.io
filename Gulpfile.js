'use strict';
var gulp = require('gulp');
var jshint = require('gulp-jshint');
var istanbul = require('gulp-istanbul');
var mocha = require('gulp-mocha');
var coverageEnforcer = require('gulp-istanbul-enforcer');
var runSequence = require('run-sequence');
var aglio = require('gulp-aglio');
var concat = require('gulp-concat');
var livereload = require('gulp-livereload');
var nodemon = require('gulp-nodemon');
var globs = {
  js: {
    lib: ['lib/**/*.js', 'start.js'],
    gulpfile: ['Gulpfile.js'],
    specs: ['tests/**/*.js', '!tests/fixtures/**/*']
  },
  specs: ['tests/**/*.js', '!tests/fixtures/**/*'],
  docs: [
    './docs/_root.md',
    './docs/*.md'
  ]
};

function runJshint() {
  return gulp.src(
      globs.js.lib.concat(
        globs.js.gulpfile)
    )
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'))
    .pipe(jshint.reporter('jshint-growl-reporter'));
}

function mochaServer(options) {

    return gulp.src(globs.specs, {
        read: false
      })
      .pipe(mocha(options || {
        reporter: 'nyan',
        growl: true
      }));
  }
  // Testing
var coverageOptions = {
  dir: './coverage',
  reporters: ['html', 'lcov', 'text-summary', 'html', 'json'],
  reportOpts: {
    dir: './coverage'
  }
};

gulp.task('jshint-build', function () {
  return runJshint().pipe(jshint.reporter('fail'));
});
gulp.task('jshint', function () {
  return runJshint();
});

gulp.task('concat-docs', function () {
  return gulp.src(globs.docs)
    .pipe(concat('apiary.apib'))
    .pipe(gulp.dest('./'));
});

gulp.task('docs', ['concat-docs'], function () {
  gulp.src(globs.docs)
    .pipe(aglio({
      template: 'flatly'
    }))
    .pipe(gulp.dest('./docs'));

  gulp.src('apiary.apib')
    .pipe(aglio({
      template: 'flatly-multi'
    }))
    .pipe(concat('index.html'))
    .pipe(gulp.dest('./docs'))
    .pipe(livereload());
});

gulp.task('mocha-server-continue', function (cb) {
  gulp.src(globs.js.lib)
    .pipe(istanbul())
    .on('error', function (err) {
      console.log('istanbul error', err);
    })
    .on('finish', function () {
      mochaServer().on('error', function (err) {
          console.trace(err);
          this.emit('end');
          cb();
        }).pipe(istanbul.writeReports(coverageOptions))
        .on('end', cb);
    });
});
gulp.task('enforce-coverage', ['mocha-server'], function () {
  var options = {
    thresholds: {
      statements: 80,
      branches: 80,
      lines: 80,
      functions: 80
    },
    coverageDirectory: 'coverage',
    rootDirectory: process.cwd()
  };
  return gulp.src(globs.js.lib)
    .pipe(coverageEnforcer(options));
});
gulp.task('mocha-server', function (cb) {
  gulp.src(globs.js.lib)
    .pipe(istanbul())
    .on('finish', function () {
      mochaServer({
          reporter: 'spec'
        })
        .pipe(istanbul.writeReports(coverageOptions))
        .on('end', cb);
    });
});

gulp.task('watch', function () {

  var watching = false;
  gulp.start(
    'jshint',
    'docs',
    'mocha-server-continue',
    function () {
      // Protect against this function being called twice
      if (!watching) {
        watching = true;
        livereload.listen();
        nodemon({
            script: 'app.js',
            watch: globs.js.lib
          })
          .on('restart', function () {
            console.log('restarted!');
          });
        gulp.watch(globs.js.lib.concat(
          globs.js.specs), ['seq-test']);
        gulp.watch(globs.js.Gulpfile, ['jshint']);
        gulp.watch(globs.docs, ['docs']);
      }
    });
});
gulp.task('seq-test', function () {
  runSequence('jshint', 'mocha-server-continue');
});
gulp.task('test', function () {
  return gulp.start('jshint-build',
    'mocha-server',
    'enforce-coverage');
});
gulp.task('build', function () {
  return gulp.start('jshint-build',
    'mocha-server',
    'enforce-coverage');
});
gulp.task('default', function () {
  return gulp.start('jshint-build',
    'mocha-server',
    'enforce-coverage');
});
