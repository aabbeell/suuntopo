// Note: Due to very limited amount of memory in certain devices
// remove all unnecessary code from this template.

var connection1, connection2,
  registered1, registered2,
  exerciseStarted,
  state,
  value1, value2,
  ext;

var waitingState = 99,
  readyState = 10;

// BLE event handler for device 1.
// characteristicId: number, characteristic ID registered with appConn.regUuid
// eventId: number, identifies BLE event
// data: byte array, event data
var bleEventHandler1 = function(characteristicId, eventId, data) {
  // Uncomment for printing to system event log of the device
  //systemEvent('BLE EV 1 ', characteristicId, ' ', eventId);
  switch (eventId) {
    case 100: // Connected
      if (!registered1) { // Do not try to register after the reconnect if already done
        state = 1; // Next connect to second device
      }
      break;

    case 107: // Service and characteristic UUIDs registered
      // Enable notifications in next call to evaluate
      state = 3;
      registered1 = 1;
      break;

    case 101: // Disconnected (Note! if connection is lost automatic reconnect attempt is done by the system)
      state = 5;
      break;

    case 109: // Config done
      state = 4; // Next wait a while
      break;

    case 106: // Received notification
      if (state == readyState) {
        systemEvent('BLE 1 data len ' + data.length);
        value1++;
      }
      break;
  }
};

// BLE event handler for device 2.
// characteristicId: number, characteristic ID registered with appConn.regUuid
// eventId: number, identifies BLE event
// data: byte array, event data
var bleEventHandler2 = function(characteristicId, eventId, data) {
  // Uncomment for printing to system event log of the device
  //systemEvent('BLE EV 2 ', characteristicId, ' ', eventId);
  switch (eventId) {
    case 100: // Connected
      if (!registered2) { // Do not try to register after the reconnect if already done
        state = 2; // Next register notifications on first device
      }
      break;
    case 106: // Received notification
      if (state == readyState) {
        systemEvent('BLE 2 data len ' + data.length);
        value2++;
      }
      break;
    case 107: // Service and characteristic UUIDs registered
      state = 5;
      registered2 = 1;
      break;
    case 109: // Config done
      state = 7; // All done
      break;
  }
};

// Load function from separate file to save memory.
// Note: Filename must start with 'ext', otherwise it won't be included in the application package.
var loadExt = function(ix) {
  ext = undefined; // gc can throw previous ext away and free its memory
  ext = evalFile('{file_path}/ext' + ix + '.js');
};

// Load service/characteristic registration function from separate file
var registerChar = function(connection, chExtFileIx) {
  loadExt(chExtFileIx);
  ext(connection);
  state = waitingState; // State will be changed by Service and characteristic UUIDs registered (107) event
};

// System starts calling this about once per second after the sports app is selected
// i.e. already before the exercise is actually started.
// input: contains resources specified in "in" section of the manifest.
// output: resources passed to the device (specified in "out" section of the manifest).
function evaluate(_input, output) {
  switch (state) {
    case 0:
      // Initiate first connection
      loadExt(1); // Load function from separate file to save memory
      connection1 = ext(bleEventHandler1); // Initiate connection and register event handler
      state = waitingState; // State will be changed by BLE Connect done (111) event
      break;

    case 1:
      // Initiate second connection
      loadExt(2);
      connection2 = ext(bleEventHandler2);
      state = waitingState;
      break;

    case 2:
      // Both connected, close "Searching" view in watch
      output.con = 1;
      // Register service and characteristic UUIDs for notifications on first device
      registerChar(connection1, 3);
      break;

    case 3:
      // Enable notifications on first device
      appConn.enaCharNotf(connection1, 1);
      state = waitingState; // State will be changed by Config done (109) event
      break;

    case 4:
      // Register service and characteristic UUIDs for notifications on second device
      registerChar(connection2, 4);
      break;

    case 5:
      // Enable notifications on second device
      appConn.enaCharNotf(connection2, 2);
      state = waitingState; // State will be changed by Config done (109) event
      break;

    case 6:
      // After disconnection
      output.con = 0;
      state = waitingState; // State will be changed during reconnection process
      break;

    case 7:
      if (exerciseStarted) {
        // Start handling of received data after the exercise has started
        state = readyState;
      }
      break;

    case waitingState:
      break;

    case readyState:
      output.value1 = value1;
      output.value2 = value2;
      break;
  }
}

// main.js loaded and system starts calling evaluate()
function onLoad(_input, output) {
  output.con =
    exerciseStarted =
    registered1 = registered2 =
    state = 0;
  value1 = value2 = 0;
}

// Is evaluated on exercise start
function onExerciseStart() {
  exerciseStarted = 1;
}

function getUserInterface() {
  return {
    template: 't'
  };
}
