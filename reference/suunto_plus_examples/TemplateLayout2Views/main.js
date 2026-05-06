var currentTemplate;

function evaluate(input, output) {
  output.value1 += 1;
  output.value2 += 2;
}

function onLoad(input, output) {
  currentTemplate = 't1';
  output.value1 =
  output.value2 = 0;
}

function onLap(input, output) {
  currentTemplate = 't2';
  unload("_cm"); // Unload & reload the screen to rerun getUserInterface
  output.value2 = 0;
}

function getUserInterface() {
  return {
    template: currentTemplate,

    // If your main.js is large these can be specified directly in the html-files by replacing:
    // {zapp_center_input} -> Zapp/{zapp_index}/Output/value1
    // {zapp_center_format} -> Count_Twodigits
    // {zapp_bottom_input} -> Zapp/{zapp_index}/Output/value2
    // {zapp_bottom_format} -> Count_Fourdigits
    center: { input: 'output/value1', format: 'Count_Twodigits' },
    bottom: { input: 'output/value2', format: 'Count_Fourdigits' },
  };
}
