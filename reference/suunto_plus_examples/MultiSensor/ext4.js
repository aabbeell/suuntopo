function(conn) {
  appConn.regUuid(conn,
    2, // ID to refer to this characteristic later
    // Service UUID 01020304-0506-0708-090A-0B0C0D0E0F00, replace with real value
    [0, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    // Characteristic UUID 01020304-0506-0708-090A-0B0C0D0E0F00, replace with real value
    [0, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  );
}
