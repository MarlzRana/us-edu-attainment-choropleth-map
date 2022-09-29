const fetchData = async (url) => {
  const response = await fetch(url);
  return await response.json();
};

const addNationToMap = (svg, nationDataset) => {
  return svg
    .append("g")
    .attr("class", "nation-line")
    .selectAll("path")
    .data(nationDataset)
    .enter()
    .append("path")
    .attr("d", d3.geoPath());
};

const addStatesToMap = (svg, statesDataset) => {
  svg
    .append("path")
    .datum(statesDataset)
    .attr("d", d3.geoPath())
    .attr("class", "state-line");
};

const addCountiesToMap = (svg, countyDataset) => {
  return svg
    .append("g")
    .attr("class", "counties")
    .selectAll("path")
    .data(countyDataset)
    .enter()
    .append("path")
    .attr("d", d3.geoPath())
    .attr("class", "county")
    .attr("data-fips", (d) => d.id);
};

const addEducationDataToMap = (svg, valueToColor, educationDataset) => {
  for (const objStateEducation of educationDataset) {
    d3.select(`path[data-fips='${objStateEducation.fips}']`)
      .attr("data-education", objStateEducation.bachelorsOrHigher)
      .attr("data-state", objStateEducation.state)
      .attr("data-county", objStateEducation.area_name)
      .attr("fill", (d) => valueToColor(objStateEducation.bachelorsOrHigher));
  }
};

const generatedValueToColor = (minValue, maxValue, colorSpectrum) => {
  const colorCount = colorSpectrum.length;
  const rangeStepValue = (maxValue - minValue) / (colorCount - 1);
  const thresholdValues = d3.range(minValue, maxValue, rangeStepValue);
  const valueToColor = d3
    .scaleThreshold()
    .domain(thresholdValues)
    .range(colorSpectrum);
  return { thresholdValues, valueToColor };
};

/* https://bl.ocks.org/mbostock/3019563 */
const applyPaddingMarginConvention = (svg, padding, margin) => {
  //Getting our svg dimension
  const outerWidth = svg.node().getBoundingClientRect().width;
  const outerHeight = svg.node().getBoundingClientRect().height;
  //Getting our inner svg dimension which define our max workable area (axis, axis labels and data)
  const innerWidth = outerWidth - margin.left - margin.right;
  const innerHeight = outerHeight - margin.top - margin.bottom;
  //Getting our "workable" svg dimension for data and where the axis edge (the axis labels will not be here)
  const width = innerWidth - padding.left - padding.right;
  const height = innerHeight - padding.top - padding.bottom;
  //Applying the translation to our svg to "automatically" handle the margin
  svg.attr("transform", `translate(${margin.left},${margin.top})`);
  return { outerWidth, outerHeight, innerWidth, innerHeight, width, height };
};

document.addEventListener("DOMContentLoaded", async () => {
  //Get the data
  const educationDatasetUrl =
    "https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/for_user_education.json";
  const countyDatasetUrl =
    "https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/counties.json";
  const [educationDataset, unformattedMapDataset] = await Promise.all([
    fetchData(educationDatasetUrl),
    fetchData(countyDatasetUrl),
  ]);

  //Get the county dataset and states dataset
  const countyGeometryDataset = topojson.feature(
    unformattedMapDataset,
    unformattedMapDataset.objects.counties
  ).features;
  const statesGeometryDataset = topojson.mesh(
    unformattedMapDataset,
    unformattedMapDataset.objects.states,
    (a, b) => a !== b //Ensures there are no overlapping arcs (a filter function)
  );
  const nationGeometryDataset = topojson.feature(
    unformattedMapDataset,
    unformattedMapDataset.objects.nation
  ).features;

  // Select the graph html element
  const graph = d3.select("#graph");

  // Creating the color threshold scale
  [minEducationAttaintment, maxEducationAttaintment] = d3.extent(
    educationDataset,
    (d) => d.bachelorsOrHigher
  );

  const { thresholdValues: educationThresholdValues, valueToColor } =
    generatedValueToColor(
      minEducationAttaintment,
      maxEducationAttaintment,
      d3.schemeGreens[9]
    );

  // Create the svg map
  const counties = addCountiesToMap(graph, countyGeometryDataset);
  addStatesToMap(graph, statesGeometryDataset);
  addNationToMap(graph, nationGeometryDataset);

  // Adding the education data
  addEducationDataToMap(graph, valueToColor, educationDataset);

  // Creating their legend
  const legend = graph
    .append("g")
    .attr("id", "legend")
    .attr("transform", `translate(${0}, ${35})`);

  //Applying padding margin convention
  // const legendMargin = { top: 10, right: 0, bottom: 0, left: 600 };
  const legendPadding = { top: 0, right: 20, bottom: 20, left: 20 };
  // const {height: legendHeight, width: legendWidth} = applyPaddingMarginConvention(legend, legendPadding, legendMargin);

  // Creating the scale
  const legendXScale = d3
    .scaleLinear()
    .domain([minEducationAttaintment, maxEducationAttaintment])
    .range([550, 860]);

  // Defining constants to be used to determine translations and sizes
  const heightOfLegendRect = 12;
  const tickOverflow = 5;
  //Creating the axis
  const legendXAxisGenerator = d3
    .axisBottom()
    .scale(legendXScale)
    .tickValues(educationThresholdValues.concat(maxEducationAttaintment))
    .tickFormat(d3.format(".1f"))
    .tickSize(-(heightOfLegendRect + tickOverflow));

  // Plotting the axis
  const legendXAxis = legend
    .append("g")
    .call(legendXAxisGenerator)
    .attr("transform", `translate(${0}, ${heightOfLegendRect + tickOverflow})`);

  //Remove the lower horizontal line/path
  legendXAxis.select(".domain").remove();

  // Creating the legend plot
  const legendPlot = legend
    .insert("g", ":first-child")
    .attr("class", "legend-plot");

  //Plotting on the legend
  legendPlot
    .selectAll("rect")
    .data(educationThresholdValues)
    .enter()
    .append("rect")
    .attr("x", (d) => legendXScale(d))
    .attr("width", (d, i) => {
      const nextValue = educationThresholdValues.concat(
        maxEducationAttaintment
      )[i + 1];
      return legendXScale(nextValue) - legendXScale(d);
    })
    .attr("height", heightOfLegendRect)
    .attr("fill", (d) => valueToColor(d));

  //Creating the tooltip
  const tooltip = d3
    .select(".graph-container")
    .append("div")
    .attr("id", "tooltip")
    .style("opacity", 0);
  //Creating our tooltip functions
  const mouseoverTooltip = (e) => {
    tooltip.transition().duration(150).style("opacity", 0.95);
    d3.select(e.srcElement).style("stroke", "#CAA791");
  };
  const mouseleaveTooltip = (e) => {
    tooltip.transition().duration(150).style("opacity", 0);
    d3.select(e.srcElement).style("stroke", "none");
  };

  const mousemoveTooltip = (e) => {
    //Get the element
    const elemCounty = d3.select(e.srcElement);

    //Clear the tooltip and update it's contents
    tooltip.selectAll("p").remove();
    tooltip
      .append("p")
      .text(
        `${elemCounty.attr("data-county")} - ${elemCounty.attr("data-state")}`
      );
    tooltip.append("p").text(`${elemCounty.attr("data-education")}%`);

    //Add the data-education attr for the tests
    tooltip.attr("data-education", elemCounty.attr("data-education"));

    //Dynamically setting the tooltip border color depending on the region
    tooltip.style("border-color", elemCounty.attr("fill"));

    // Place the tooltip in its positon
    tooltip
      .style("left", e.pageX + 15 + "px")
      .style("top", e.pageY - 20 + "px");
  };
  counties
    .on("mouseover", mouseoverTooltip)
    .on("mouseleave", mouseleaveTooltip)
    .on("mousemove", mousemoveTooltip);
});
