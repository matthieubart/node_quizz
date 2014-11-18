function dessiner(donnees){
  var widthG = 740,
  width = 600,
  barHeight = 30;
  var colorTab = ["clair", "mclair", "mfonce", "fonce"];

  var max = 0;
  for (var i = donnees.length - 1; i >= 0; i--) {
    if(donnees[i][2] > max)
      max = donnees[i][2];
  };
  var x = d3.scale.linear()
  .range([0, width])
  .domain([0, max, function(d) {return d[2]; }]);

  var chart = d3.select("#contenu")
  .append("svg")
  .attr("width", widthG)
  .attr("height", barHeight * donnees.length + 135 );
  
  var bar = chart.selectAll("g")
  .data(donnees)
  .enter().append("g")
  .attr("transform", function(d, i) { return "translate(0," + i * barHeight + ")"; });

  bar.append("rect")
  .attr("width", function(d) { return x(d[2]); })
  .attr("height", barHeight - 2)
  .attr("class", function(d) {
    if(d[1] < -10){
      return colorTab[0];
    } else {
      if(d[1] < 1){
        return colorTab[1];
      } else {
        if(d[1] < 10){
          return colorTab[2];
        } else {
          return colorTab[3];
        }
      }
    }
  });

  bar.append("text")
  .attr("x", function(d) { return x(d[2]) + 3; })
  .attr("y", barHeight / 2)
  .attr("dy", ".35em")
  .text(function(d) { return d[0] + " : " + d[2]; });
  
  var cadreH = d3.select("svg")
  .append("g")
  .attr("transform", "translate(0," + barHeight * donnees.length + ")")
  .append("rect")
  .attr("width", widthG + 10 )
  .attr("height", "3");

  var cadreV = d3.select("svg")
  .append("g")
  .attr("transform", "translate(0,0)")
  .append("rect")
  .attr("width", "3" )
  .attr("height", barHeight * donnees.length);

  var textLegend = d3.select("svg")
  .append("text")
  .attr("x", widthG - 175)
  .attr("y", barHeight * donnees.length + 10 )
  .attr("dy", ".6em")
  .text("Nombre de parties jouées");


  var legend = chart.append("g")
  .attr("class" , "legende")
  .selectAll(".legende")
  .data(colorTab)
  .enter()
  .append("g")
  .attr("transform", function(d, i) { return "translate(0," + (barHeight * donnees.length + 26 * i + 20) + ")"; })

  var rectangle = legend
  .append("rect")
  .attr("width", "50")
  .attr("height", "25")
  .attr("class", function(d) {
    return d;
  });

  var legende = legend
  .append("text")
  .attr("dy", ".6em")
  .attr("x", '52')
  .attr("y", "10")
  .text(function(d, i){
    switch(i){
      case 0 : 
        return "score total < 10 points";
        break;
      case 1 : 
        return "10 points < score total  <= 0 points";
        break;
      case 2 : 
        return "0 points < score total  <= 10 points";
        break;
      case 3 : 
        return "10 points < score total";
        break;
    }
  })

}