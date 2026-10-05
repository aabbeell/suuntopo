function evaluate(input, output) {
  output.value1 += 1;
  output.value2 += 2;
}

function onLoad(input, output) {
  output.value1 =
  output.value2 = 0;
}

function getUserInterface() {
  return {
    template: 't',
    
    // If your main.js is large these can be specified directly in the html-files by replacing:
    // {zapp_center_input} -> Zapp/{zapp_index}/Output/value1
    // {zapp_center_format} -> Count_Fourdigits
    // {zapp_center_title} -> Value 1
    // {zapp_bottom_input} -> Zapp/{zapp_index}/Output/value2
    // {zapp_bottom_format} -> Count_Fourdigits
    // {zapp_bottom_title} -> Value 2
    center: { input: 'output/value1', format: 'Count_Fourdigits', title: 'Value 1' },
    bottom: { input: 'output/value2', format: 'Count_Fourdigits', title: 'Value 2' },
  };
}
