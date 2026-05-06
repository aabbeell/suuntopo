function onLoad(_input, output) {
  output.topCount = 0;
  output.bottomCount = 0;
}

// Handles events from pushButton HTML element
function onEvent(_input, output, eventId) {
  switch (eventId) {
    // Top button pressed
    case 1:
      output.topCount++;
      break;
    // Top button, long press
    case 2:
      if (output.topCount > 0) {
        output.topCount--;
      }
      break;
    // Bottom button pressed
    case 3:
      output.bottomCount++;
      break;
    // Bottom button, long press
    case 4:
      if (output.bottomCount > 0) {
        output.bottomCount--;
      }
      break;
  }
}

function getUserInterface() {
  return {
    template: 't'
  };
}
