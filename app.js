const express = require("express");
const app = express();
app.use(express.json());
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
let db = null;

const initDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  } catch (error) {
    console.log(`DB Error : ${error.message}`);
  }
  app.listen(3000, () => {
    console.log("Server Started Successfully");
  });
};

initDBAndServer();
// AUTHENTICATION
const authenticationToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userValidationQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
  const userDetails = await db.get(userValidationQuery);
  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const payload = { username: username };
    const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
    const passwordVerified = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (passwordVerified === true) {
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
app.get("/states/", authenticationToken, async (request, response) => {
  const statesListQuery = `
    SELECT state_id as stateId, state_name as stateName, population FROM state;`;
  const statesList = await db.all(statesListQuery);
  response.send(statesList);
});

//API 3
app.get("/states/:stateId", authenticationToken, async (request, response) => {
  //console.log(request.params);
  const { stateId } = request.params;
  const oneStateQuery = `
    SELECT state_id as stateId, state_name as stateName,
    population FROM state WHERE state_id = ${stateId};`;
  const oneState = await db.get(oneStateQuery);
  response.send(oneState);
});

//API 4
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postQuery = `
    INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
    VALUES(
        '${districtName}',
        ${stateId}, 
        ${cases},
        ${cured}, 
        ${active},
        ${deaths}
    );`;
  const lastId = await db.run(postQuery);
  console.log(lastId.lastID);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getQuery = `
    SELECT district_id as districtId, 
    district_name as districtName, 
    state_id as stateId,
    cases, cured, active, deaths FROM district WHERE district_id = ${districtId};`;
    const singleDistrict = await db.get(getQuery);
    response.send(singleDistrict);
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
    DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const putQuery = `
    UPDATE district 
    SET  district_name = '${districtName}', 
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured}, 
    active = ${active}, 
    deaths = ${deaths}
    WHERE district_id = ${districtId};`;
    await db.run(putQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const gettingQuery = `
    SELECT SUM(cases) as totalCases, 
    SUM(cured) as totalCured, 
    SUM(active) as totalActive, 
    SUM(deaths) as totalDeaths
    FROM district 
    WHERE state_id = ${stateId}
    ;`;
    const totalSum = await db.get(gettingQuery);
    response.send(totalSum);
  }
);

module.exports = app;
