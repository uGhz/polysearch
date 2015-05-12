var gulp        = require("gulp"),
    browserify  = require("browserify"),
    transform   = require("vinyl-transform"),
    source      = require('vinyl-source-stream'),
    buffer      = require('vinyl-buffer'),
    uglify      = require('gulp-uglify'),
    minifyCss   = require('gulp-minify-css'),
    concat      = require('gulp-concat'),
    sourcemaps  = require('gulp-sourcemaps');
 
gulp.task('build-css', function() {
  return gulp.src('./css/*.css')
    // .pipe(sourcemaps.init())
    .pipe(minifyCss())
    // .pipe(sourcemaps.write())
    .pipe(concat("styles.css"))
    .pipe(gulp.dest('./dist/css'));
});


gulp.task('default', function() {
  // place code for your default task here
    console.log('Hello Gulp.js!');
});

gulp.task('build', function () {
    return browserify([__dirname + '/js/main.js']).bundle()
        .pipe(source('main.js'))
        .pipe(buffer())
        .pipe(uglify())
        .pipe(gulp.dest(__dirname + '/dist/js'));
});

/*gulp.task('copy', function(){
  gulp.src('./js/main.js')
    .pipe(gulp.dest('./dist/js'));
});*/

gulp.task("browserify", function () {
  var browserified = transform(function(filename) {
    var b = browserify(filename);
    return b.bundle();
  });
  return gulp.src('./js/main.js')
    .pipe(browserified)
    .pipe(gulp.dest('./dist/js'));
});