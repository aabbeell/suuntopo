function evaluate(_input, output) {
  output.value1++;
}

function onLoad(_input, output) {
  output.value1 = 0;
}

function getUserInterface() {
  return {
    template: 't',

    // If your main.js is large these can be specified directly in the html-files by replacing:
    // {zapp_center_input} -> Zapp/{zapp_index}/Output/value1
    // {zapp_center_format} -> Count_Twodigits
    // {zapp_center_unit} -> unit1
    center: { input: 'output/value1', format: 'Count_Twodigits', unit: 'unit1' }
  };
}
