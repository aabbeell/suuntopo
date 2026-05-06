//
// Connect to BLE device 1, replace service UUID with real value
//
function(evHandler) {
  // appConn: System object for connection handling
  return appConn.connect(
    enabledZappId, // Id of the app set by the system
    evHandler, // BLE event handler defined in the main.js

    // Search service UUID 01020304-0506-0708-090A-0B0C0D0E0F00 (little-endian)
    // from partial and complete lists (128 bit).
    [6, 0, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    [7, 0, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
  );
}
