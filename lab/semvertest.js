import semverMaxSatisfying from "semver/ranges/max-satisfying.js";
import semver from "semver";

console.log(semver.intersects("^1.0.0","1.0.1"));
//let vers=["^1.0.2","^1.0.3"]

//console.log(semverMaxSatisfying(["1.0.0","1.0.1","1.0.2","1.0.3"],"^1.0.1"));

//console.log(semver.)