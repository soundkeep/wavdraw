// WavDraw.js 0.0.2 - JavaScript PCM plotting library
// Author - Michael Toymil
// Dependencies - Raphael.js, underscore.js (TODO: get rid of this), jQuery

(function(glob) {
  'use strict';
  // 'glob' is usually the window
  var version = '0.0.2';
  var Raphael = glob.Raphael;
  var defaultOptions = {
    // Drawing options
    width: null,                  // Drawing width
    height: null,                 // Drawing height
    strokeWidth: 2,
    strokeColor: "#FF0000",

    // PCM options
    //signed: true, // TODO
    bitDepth: 16,
    skip: 1,

    autoSkip: true,
    autoSkipFactor: 5,

    // Loading feature options
    useloading: false,
    loadingStrokeWidth: 1,
    loadingStrokeColor: "#555",

    // Queue options
    useQueue: false,
  }

  // Queue
  var drawQueue = []; // our fancy queue
  var running = false;
  //var loadingTimeout;
  //var queueLoaded = false;
  $(glob).on('wavdrawDone', function() {
    if (!drawQueue.length) {
      //queueLoaded = false;
      running = false;
      return;
    }

    var job = drawQueue.shift();
    drawTask(job.paper, job.pathData);
  });

  $(glob).on('startQueue', function() {
    if (!drawQueue.length) {
      running = false;
      return;
    }

    var job = drawQueue.shift();
    drawTask(job.paper, job.pathData);
  });

  // The drawing function
  var drawTask = function(paper, pathData) {
    running = true;
    _.defer(function() {
      console.log('drawing');
      // Generate pathstring
      var x, y;
      var ps = "M" + pathData.startX + "," + pathData.startY;
      for (var i=pathData.start; i<=pathData.end; i=i+pathData.skip) {
        x = ((i/pathData.bufferView.length)*paper.width);
        y = ((paper.height/2)-(pathData.bufferView[i]/pathData.maxAmp)*(paper.height/2))
        ps += "L"+ x + "," + y;
      }
      
      // Draw with Raphael
      var path = paper.path(ps);
      path.attr('stroke-width', pathData.width);
      path.attr('stroke', pathData.color);
 
      $.event.trigger({type:'wavdrawDone'});
           
      // Return the path in case anyone cares
      return;
    });
  }

  // Our queue push method (TODO: encapsulate queue stuff)
  var pushToQueue = function(paper, pathData, useQueue) {
    if (useQueue) {
      drawQueue.push({
        paper: paper,
        pathData: pathData
      });
      //clearTimeout(loadingTimeout);
      //loadingTimeout = setTimeout(function() {
        //loadingTimeout = null;
        //queueLoaded = true;
      //}, 100);
      if (drawQueue.length && !running) {
        // var job = drawQueue.shift();
        // drawTask(job.paper, job.pathData);
        $.event.trigger('startQueue');
      }
    } else {
      return drawTask(paper, pathData)
    }
  }

  // Factory function that will create a WavDraw instance for a given node.
  // node - DOM node to draw to
  // options - hash of options (as outlined above)
  //
  var WavDraw = function(node, options) { // The object we will tack onto 'glob'
    // Set up options
    options = _.extend({}, defaultOptions, options || {});
    options.width = options.width || $(node).width();
    options.height = options.height || $(node).height();
    // Create Raphael paper
    var paper = Raphael(node, options.width, options.height);
    paper.setViewBox(0,0,paper.width,paper.height, true);
    //var masterSet = paper.set();
    // Internal methods and attributes
    var priv = {

      buffer: null,   // the raw buffer for a given wavdraw instance
      lastProgress: 0,// the last progress value passed to the wavdraw instance
      loaded: false,  // has the first waveform been drawn/queued

      drawWave: function(buffer, color, width, progress) {
        // Create the bufferView
        var maxAmp, bufferView;
        switch(options.bitDepth) { // TODO: Add other depths
          case 16:
            maxAmp = 32768;
            bufferView = new Int16Array(buffer);
            break;
          default:
            break;
        }

        // Drawing params
        var start = (progress == undefined) ? 0 : Math.floor(priv.lastProgress * bufferView.length);
        var end = (progress == undefined) ? bufferView.length : Math.floor(progress * bufferView.length);
        var startX = ((start/bufferView.length) * paper.width);
        var startY = ((paper.height/2)-(bufferView[start]/maxAmp) * (paper.height/2))
        var skip = options.autoSkip ? Math.ceil( bufferView.length / (options.autoSkipFactor * paper.width) ) : options.skip;

        // Save progress
        priv.lastProgress = (progress == undefined) ? priv.lastProgress : progress;

        // Data required to draw a path
        var pathData = {
          maxAmp: maxAmp,
          bufferView: bufferView,
          width: width,
          color: color,
          startX: startX,
          startY: startY,
          start: start,
          end: end,
          skip: skip
        }
        return pushToQueue(paper, pathData, options.useQueue);      
      },

      drawProgressSubpath: function(progress, buffer) {
        var subpath = priv.drawWave(buffer, options.strokeColor, options.strokeWidth, progress);
        return subpath;
      }
    }
    
    // The WavDraw API instance to return
    // TODO make options mutable and the instance more dynamic in general
    var wd = {
      
      // Load in PCM buffer to draw
      loadPCM: function(buffer) {
        var path, color, width;
        priv.buffer = buffer;
        if (options.useLoading) {
          color = options.loadingStrokeColor;
          width = options.loadingStrokeWidth;
        } else {
          color = options.strokeColor;
          width = options.strokeWidth;
        }

        priv.drawWave(buffer, color, width);
        priv.loaded = true;
      },

      getLoaded: function() { // yeeeeeeee
        return priv.loaded;
      },

      getProgress: function() {
        return priv.lastProgress;
      },
     
      // For the loading progress feature only
      setProgress: function(progress) {
        if (!options.useLoading || !priv.loaded) {
          return;
        }

        if (((typeof progress) !== "number") || progress < 0 || progress > 1) {
          return;
        }
        priv.drawProgressSubpath(progress, priv.buffer);
      },

      setViewBox: function(x,y,w,h,fit) {
        paper.setViewBox(x,y,w,h,fit)
      },

      // Returns Raphael paper instance
      getPaper: function() {
        return paper;
      }
    };
    
    return wd;
  }; 

  WavDraw.toString = function() {
    return 'Wavdraw version: ' + version + '\nRaphael version: ' + Raphael.version + '\nRock on!';
  }

  glob.WavDraw = WavDraw;
})(this);

