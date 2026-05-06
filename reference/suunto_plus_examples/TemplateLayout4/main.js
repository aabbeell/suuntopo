function evaluate(input, output) {
  output.value1 += 1;
  output.value2 += 2;
  output.value3 += 3;
  output.value4 += 1.1;
}

function onLoad(input, output) {
  output.value1 =
  output.value2 =
  output.value3 = 0;
  output.value4 = 0.0;
}

function getUserInterface() {
  return {
    template: 't',

    // If your main.js is large these can be specified directly in the html-files by replacing:
    // {zapp_tl1_input} -> Zapp/{zapp_index}/Output/value1
    // {zapp_tl1_format} -> Count_Threedigits
    // {zapp_tl2_input} -> Zapp/{zapp_index}/Output/value2
    // {zapp_tl2_format} -> Count_Threedigits
    // etc.
    tl1: { input: 'output/value1', format: 'Count_Threedigits' },
    tl2: { input: 'output/value2', format: 'Count_Threedigits' },
    tr:  { input: 'output/value3', format: 'Count_Twodigits' },
    mid: { input: 'output/value4', format: 'Count_FixedNoLeadingZero' },
    bottom: { input: '/Activity/Activity/-1/Distance/Current', format: 'Distance_Threedigits' }
  };
}
