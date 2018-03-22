// Define a properties array that returns array of objects representing
// the accepted properties for your application
var properties = function(projectSettings){
  var distanceMin = 0;
  var distanceValue = 0.25;
  var distanceMax = 1;
  var distanceStep = 0.001;
  
  if (projectSettings.preferredUnit === 'mm'){
    distanceValue = 6;
    distanceMax = 25;
    distanceStep = 1;
  }
  
  return [
    {type: 'range', id: "Distance", value: distanceValue, min: distanceMin, max: distanceMax, step: distanceStep },
    {type: 'range', id: "Iterations", value: 1, min: 1, max: 10, step: 1 },
    {type: 'boolean', id: "Inwards?", value: false},
    {type: 'boolean', id: "Keep original?", value: true}
  ];
};

var getSelectedVolumes = function(volumes, selectedVolumeIds){
  return volumes.filter(function(volume){
    return selectedVolumeIds.indexOf(volume.id) >= 0;
  });
};

// Define an executor function that builds an array of volumes,
// and passes it to the provided success callback, or invokes the failure
// callback if unable to do so
var executor = function(args, success, failure) {
  //console.dir(args);
  var params = args.params;
  var direction = args.params['Inwards?'] ? -1 : 1;
  var iterations = args.params['Iterations'];
  var keepOriginal = args.params['Keep original?'];
  var distance = args.params['Distance'];
  if (args.preferredUnit === 'mm'){
    distance /= 25.4;
  }
  
  var selectedVolumes = getSelectedVolumes(args.volumes, args.selectedVolumeIds);
  if (selectedVolumes.length === 0) {
    failure('No shape selected');
  }
  
  var delta = distance * direction;
  var newVolumes = [];
  var originalVolumes = [];
  
  selectedVolumes.forEach(function(selectedVolume){
    var cut = JSON.parse(JSON.stringify(selectedVolume.cut));
    var segments;
    
    if (selectedVolume.shape.type === 'text'){
      segments = EASEL.segmentVisitor.visit(selectedVolume.shape.fontPath, EASEL.matrix());
    }
    else {
      segments = EASEL.segmentVisitor.visit(selectedVolume.shape, EASEL.matrix());
    }
    
    if (segments.length > 0){
      segments.forEach(function(path){
        var newVolume = EASEL.pathUtils.fromPointArrays([path]);
        if (newVolume) {
          newVolume.cut = cut;
          originalVolumes.push(newVolume);
        }
      });
      
      /* remove the original */
      selectedVolume.shape = null;
      selectedVolume.cut = null;
      newVolumes.push(selectedVolume);
    }
  });

  if (keepOriginal){
    newVolumes = newVolumes.concat(originalVolumes);
  }
  
  for (var x=1; x<=iterations; x++){
    var offset = delta * x;
    var offsetVolumes = EASEL.volumeHelper.offset(originalVolumes, offset).filter(function(volume){ return volume !== null; });
    newVolumes = newVolumes.concat(offsetVolumes);
  }

  return success(newVolumes);
};
