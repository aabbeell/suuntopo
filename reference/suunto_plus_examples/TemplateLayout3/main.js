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
    // {zapp_tl1_input} -> Zapp/{zapp_index}/Output/value1
    // {zapp_tl1_format} -> Count_Fourdigits
    // {zapp_tl1_title} -> Value 1
    // {zapp_tl1_unit} -> unit1
    // {zapp_tr1_input} -> Zapp/{zapp_index}/Output/value2
    // {zapp_tr1_format} -> Count_Fourdigits
    // {zapp_tr1_title} -> Value 2
    // etc.
    tl1: { input: 'output/value1', format: 'Count_Fourdigits', title: 'Value 1', unit: 'unit1' },
    tr1: { input: 'output/value2', format: 'Count_Fourdigits', title: 'Value 2', unit: 'unit2' },
    tl2: { input: 'output/value3', format: 'Count_Fourdigits', title: 'Value 3', unit: 'unit3' },
    tr2: { input: 'output/value4', format: 'Count_Fourdigits', title: 'Value 4', unit: 'unit4' },
    bottom: { input: 'Activity/Move/-1/Duration/Current', format: 'Duration_Training', title: 'Duration'}
  };
}
