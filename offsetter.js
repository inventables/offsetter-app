// Define a properties array that returns array of objects representing
// the accepted properties for your application
var properties = [
  {type: 'range', id: "Distance", value: 0.25, min: 0, max: 1, step: 0.0001},
  {type: 'range', id: "Iterations", value: 1, min: 0, max: 10, step: 1},
  {type: 'boolean', id: "Inwards?", value: false},
  {type: 'boolean', id: "Keep original?", value: true},
  // {type: 'boolean', id: "Group?", value: false}
];

// flip a point vertically to the SVG coordinate system where +Y is down
var flipPointY = function(point) {
  return [point[0], -point[1]];
};

var flipPointArraysY = function(pointArrays) {
  return pointArrays.map(function(pointArray) {
    return pointArray.map(flipPointY);
  });
};

var offsetPoint = function(point, dx, dy) {
  return [point[0] + dx, point[1] + dy];
};

var offsetPointArrays = function(pointArrays, dx, dy) {
  return pointArrays.map(function(pointArray) {
    return pointArray.map(function(point) {
      return offsetPoint(point, dx, dy);
    });
  });
}; 

var scale = 100000;
var lightenThreshold = 8;

var inputToClipper = function(pointArrays) {
  return pointArrays.map(function(pointArray) {
    return pointArray.map(function(point) {
      return {
        X: point[0] * scale,
        Y: point[1] * scale
      };
    });
  });
};

var formatClipperPoint = function(point) {
  return (point.X / scale).toFixed(4) + " " + (point.Y / scale).toFixed(4);
};

var clipperToPath = function(pointArrays, shouldGroup) {
  var path = "";
  
  if (shouldGroup) {
    path = '<path d="';
  }
  
  for (var j=0; j < pointArrays.length; j++) {
    var points = pointArrays[j];
    var iteration = '';
    
    if (!shouldGroup) {
      iteration = '<path d="';
    }

    if (j%2 === 0) {
      points.reverse();
    }

    iteration += "M" + formatClipperPoint(points[0]);

    for (var i=1; i < points.length; i++) {
      iteration += "L" + formatClipperPoint(points[i]);
    }
    
    if (!shouldGroup) {
      iteration += 'Z" stroke="#666" fill="transparent" stroke-width="0.05"></path>';
    }
    
    path += iteration;
  }
  
  if (shouldGroup) {
    path += '" stroke="#666" fill="transparent" stroke-width="0.05"></path>';
  }
  
  return path;
};

function simplify(polygons) {
  return ClipperLib.Clipper.SimplifyPolygons(polygons, ClipperLib.PolyFillType.pftNonZero);
}

function offset(polygons, step, maxIterations, keepOriginal, joinType, isFill) {

  var clipperEndType, clipperJoinType, i, iteration, iterationPolygons, j, lastIterationPolygons, len, offsetPolygons, offsetter, polygon, ref, scaledStep;
  if (maxIterations == null) {
    maxIterations = 1;
  }
  if (joinType == null) {
    joinType = 0;
  }
  if (isFill == null) {
    isFill = true;
  }
  scaledStep = step * scale;
  if (isFill) {
    polygons = ClipperLib.JS.Lighten(polygons, lightenThreshold);
  }
  offsetter = new ClipperLib.ClipperOffset();
  offsetter.MiterLimit = 5;
  offsetPolygons = [];
  clipperJoinType = (function() {
    switch (false) {
      case joinType !== 0:
        return ClipperLib.JoinType.jtRound;
      case joinType !== 1:
        return ClipperLib.JoinType.jtMiter;
      case joinType !== 2:
        return CLipperLib.JoinType.jtSquare;
    }
  })();
  clipperEndType = isFill ? ClipperLib.EndType.etClosedPolygon : ClipperLib.EndType.etOpenRound;
  lastIterationPolygons = polygons;
  offsetPolygons = offsetPolygons.concat(polygons);
  
  lastIterationPolygons = simplify(lastIterationPolygons);

  
  for (iteration = i = 1, ref = maxIterations; 1 <= ref ? i <= ref : i >= ref; iteration = 1 <= ref ? ++i : --i) {
    iterationPolygons = new ClipperLib.Paths();
    offsetter.Clear();
    offsetter.AddPaths(lastIterationPolygons, clipperJoinType, clipperEndType);
    offsetter.Execute(iterationPolygons, scaledStep);
    iterationPolygons = ClipperLib.JS.Lighten(iterationPolygons, lightenThreshold);
    if (iterationPolygons.length === 0 || iterationPolygons[0].length === 0) {
      break;
    }
    for (j = 0, len = iterationPolygons.length; j < len; j++) {
      polygon = iterationPolygons[j];
      polygon.push(polygon[0]);
    }
    offsetPolygons = offsetPolygons.concat(iterationPolygons);
    lastIterationPolygons = iterationPolygons;
  }
  
  if (!keepOriginal){
    offsetPolygons.shift();
  }
  
  return offsetPolygons;
}


// Define an executor function that generates a valid SVG document string,
// and passes it to the provided success callback, or invokes the failure
// callback if unable to do so
var executor = function(args, success, failure) {
  var params = args[0];
  var input = args[1].pointArrays;
  
  var shapeProperties = args[1];
  var shapeWidth = shapeProperties.right - shapeProperties.left;
  var shapeHeight = shapeProperties.top - shapeProperties.bottom;
  var pointArrays = flipPointArraysY(offsetPointArrays(shapeProperties.pointArrays, -shapeProperties.left, -shapeProperties.top));
  var resultPointArrays = [];
  
  var clipperInput = inputToClipper(pointArrays);
  var offsetDistance = params['Distance'] * (params['Inwards?'] ? -1 : 1);
  var clipperOutput = offset(clipperInput, offsetDistance, params['Iterations'], params['Keep original?']);
  var path = clipperToPath(clipperOutput, params['Group?']);
  
  var padding = 0.25;
  var expansion = params['Inwards?'] ?  padding : (offsetDistance * params['Iterations'] + padding);
  var width = shapeWidth + 2 * expansion;
  var height = shapeHeight + 2 * expansion;
  var viewBox = [-expansion, -expansion, width, height].join(' ');

  var svg = [
    '<?xml version="1.0" standalone="no"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="' + width + 'in" height="' + height + 'in" viewBox="' + viewBox + '">',
    path,
    '</svg>'
  ].join("");

  success(svg);
};
