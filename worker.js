this.onmessage=function(response){
  var sentence = "Hello " + response.data.fName + " " +   response.data.lName;
  this.postMessage({result: sentence});
}