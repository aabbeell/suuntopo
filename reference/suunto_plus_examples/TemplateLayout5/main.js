function evaluate(input, output) {
  output.value1 += 1;
  output.value2 += 2;
  output.value3 += 3;
  output.value4 += 4;
}

function onLoad(input, output) {
  output.value1 =
  output.value2 =
  output.value3 =
  output.value4 = 0;
}

function getUserInterface() {
  return {
    template: 't',

    // If your main.js is large these can be specified directly in the html-files by replacing:
    // {zapp_tl_input} -> Zapp/{zapp_index}/Output/value1
    // {zapp_tl_format} -> Count_Threedigits
    // {zapp_tr_input} -> Zapp/{zapp_index}/Output/value2
    // {zapp_tr_format} -> Count_Threedigits
    // etc.
    tl: { input: 'output/value1', format: 'Count_Threedigits' },
    tr: { input: 'output/value2', format: 'Count_Threedigits' },
    ml: { input: 'output/value3', format: 'Count_Threedigits' },
    mr: { input: 'output/value4', format: 'Count_Threedigits' },
    bottom: { input: '/Activity/Activity/-1/Duration/Current', format: 'Duration_Training' }
  };
}
