require("dotenv").config();
const axios = require("axios");
const express = require("express");
const app = express();
app.use(express.json());

// Salesforce OAuth credentials
const HUB_ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const BASE_URI = process.env.BASE_URI;
const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;
const USERNAME = "apps@makewebbetter.com";
const PASSWORD = process.env.PASSWORD;
const redirectUri = process.env.SALESFORCE_REDIRECT_URI;
const salesforceLoginUrl = "https://login.salesforce.com";
const access_token='00D2v000002GS7P!AQEAQGVDSsD2DlqHVYMJn3tLDVAGi.r00pVYyW78FvX7bjB40IouJE8fE7mQkKew7hdjHCbaOn.7h2ZMiLUVG6ZvtnepA7IK';
const instance_url='https://d2v000002gs7peaw.my.salesforce.com'
const hsHelpers = require('./hshelpers.js');


app.get("/fetch-leads", async (req, res) => {
  try {
    // by using csv or json 
    console.log("hiiiiii");
    const filePath = require("path").join(__dirname, "files", "Leadupp.json");
    console.log("filePath:", filePath);
    const datas = await hsHelpers.readDataFromJson(filePath);  // Await the file reading function
    const processedContacts1 = await hsHelpers.syncContactData(datas);
  
    // const getNotes = await processNotes(data,access_token, instance_url);
    // const getEmail = await processEmail(data, access_token, instance_url);
    res.json({ message: "Salesforce token fetched successfully", access_token, instance_url });
  } catch (error) {
    console.error("Error fetching Salesforce token:", error.message);

    if (!res.headersSent) {
      res.status(500).json({
        message: "Error fetching Salesforce token",
        error: error.message,
      });
    }
  }
});


//endpoint to get  company(account)
app.get("/fetch-account", async (req, res) => {
  try {

    console.log("company");
    const filePath = require("path").join(__dirname, "files", "account.json");
    console.log("filePath:", filePath);
    const datas = await hsHelpers.readDataFromJson(filePath);  // Await the file reading function

    // const data = await fetchAllCompanys(access_token, instance_url);
    // const getNotes = await processNotes(data,access_token, instance_url);
    res.json({ message: "Salesforce token fetched successfully", access_token, instance_url });
  } catch (error) {
    console.error("Error fetching Salesforce token:", error.message);

    if (!res.headersSent) {
      res.status(500).json({
        message: "Error fetching Salesforce token",
        error: error.message,
      });
    }
  }
});


//endpoint to get  deal(opportunity)
app.get("/fetch-opportunity", async (req, res) => {
  try {
    const data = await fetchAllOpportunity(access_token, instance_url);
    // const getNotes = await processNotes(data,access_token, instance_url);
    // console.log("getNotes",getNotes);
    // const getEmail = await processEmail(data, access_token, instance_url);
    const getFiles = await fetchOpportunityDocumentAndFile(data, access_token, instance_url);
    res.json({ message: "Salesforce token fetched successfully", access_token, instance_url });
  } catch (error) {
    console.error("Error fetching Salesforce token:", error.message);

    if (!res.headersSent) {
      res.status(500).json({
        message: "Error fetching Salesforce token",
        error: error.message,
      });
    }
  }
});

async function fetchAllOpportunity(access_token, instance_url) {
  let allOpportunity = [];
  let url = `${instance_url}/services/data/v52.0/query?q=SELECT+Id,Name+FROM+Opportunity`;
  while (url) {
      const response = await axios.get(url, {
          headers: {
              Authorization: `Bearer ${access_token}`
          }
      });  

      const { records, done, nextRecords } = response.data; 

      allOpportunity = allOpportunity.concat(records);
     
      url = done ? null : `${instance_url}/services/data/v52.0/query?q=SELECT+Id,Name+FROM+Opportunity&${nextRecords}`;
    }
  // console.log("allOpportunity:", allOpportunity);
  return allOpportunity;
}


async function processNotes(datas, access_token, instance_url) {
  for (const data of datas) {
      const notes = await fetchNotes(data.Id, access_token, instance_url);

      // Save each note to the database or handle as needed
      // for (const note of notes) {
      //     const noteData = new Note({
      //         contactId: contact.Id, // reference to the contact in your DB
      //         title: note.Title,
      //         body: note.Body,
      //     });
      //     await noteData.save();
      //     console.log(`Note for contact ${contact.Id} saved successfully.`);

      //     // Sync only the current note with HubSpot
      //     await syncNotesWithHubSpot(contact.Id, note);
      // }
  }
}
async function fetchNotes(dataId, access_token, instance_url) {
  try {
    // Step 1: Fetch ContentDocument IDs linked to the Contact
    const contentDocLinkUrl = `${instance_url}/services/data/v52.0/query?q=SELECT+ContentDocumentId+FROM+ContentDocumentLink+WHERE+LinkedEntityId='${dataId}'`;
    const docLinkResponse = await axios.get(contentDocLinkUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const contentDocumentIds = docLinkResponse.data.records.map(record => `'${record.ContentDocumentId}'`);

    if (contentDocumentIds.length === 0) {
      console.log(`No ComposeText notes found for contact ${dataId}`);
      return [];
    }

    // Step 2: Fetch ContentVersion records using ContentDocumentId
    const contentVersionUrl = `${instance_url}/services/data/v52.0/query?q=SELECT+Id,Title,VersionData+FROM+ContentVersion+WHERE+ContentDocumentId+IN+(${contentDocumentIds.join(",")})`;
    const noteResponse = await axios.get(contentVersionUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    console.log(`Notes for data ${dataId}:`, noteResponse.data.records);
    return noteResponse.data.records; // Returns an array of ComposeText notes

  } catch (error) {
    console.error(`Error fetching notes for data ${dataId}:`, error.response ? error.response.data : error.message);
    return [];
  }
}


async function processEmail(contacts, access_token, instance_url) {
  const results = []; 

  for (const contact of contacts) {
      const result = await fetchEmail(contact, access_token, instance_url);
      console.log(`Emails for contact ${contact.Id}:`, result.emails);

   
  }

  console.log('Combined Results:', results);
  syncEmailsWithHubSpot(results, access_token, instance_url);
  return results; // Return the combined results if needed
}


async function fetchEmail(contact, access_token, instance_url) {
  try {
      if (!contact.Id) {
          console.error("Skipping invalid contact:", contact);
          return { contactId: contact.Id, emails: [] };
      }

      const contactId = contact.Id.trim();
      console.log("Fetching emails for Data ID:", contactId);

      // Fetch emails related to this contact
      const emailQuery = `SELECT Id, Subject, FromAddress, ToAddress, TextBody, CreatedDate 
      FROM EmailMessage 
      WHERE Id IN (SELECT EmailMessageId FROM EmailMessageRelation WHERE RelationId = '${contactId}')`;

      const emailResponse = await axios.get(`${instance_url}/services/data/v52.0/query?q=${encodeURIComponent(emailQuery)}`, {
          headers: {
              Authorization: `Bearer ${access_token}`,
              'Content-Type': 'application/json'
          }
      });

      const emails = emailResponse.data.records || [];
      console.log("emails",emails);
      console.log(`Fetched ${emails.length} emails for contact ${contactId}`);

      return { contactId, emails };

  } catch (error) {
      console.error("Error fetching emails:", error.response ? error.response.data : error.message);
      return { contactId: contact.Id, emails: [] };
  }
}




async function fetchOpportunityDocumentAndFile(opportunities, access_token, instance_url) {
    try {
        if (!Array.isArray(opportunities) || opportunities.length === 0) {
            console.error("No valid opportunities found:", opportunities);
            return [];
        }

        let allDocumentsAndFiles = [];

        for (let opportunity of opportunities) {
            if (!opportunity.Id) {
                console.error("Skipping invalid opportunity:", opportunity);
                continue;
            }

            const opportunityId = opportunity.Id.trim();
            console.log("Fetching documents and files for Opportunity ID:", opportunityId);

            // Step 1: Fetch ContentDocument IDs
            const documentQuery = `SELECT ContentDocumentId 
                FROM ContentDocumentLink 
                WHERE LinkedEntityId = '${opportunityId}'`;

            let documentResponse = await axios.get(`${instance_url}/services/data/v52.0/query?q=${encodeURIComponent(documentQuery)}`, {
                headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' }
            });

            let documentIds = documentResponse.data.records.map(doc => doc.ContentDocumentId);
            console.log("documentIds", documentIds);
            if (documentIds.length === 0) {
                console.log(`No documents found for Opportunity ID: ${opportunityId}`);
                continue;
            }

            // Step 2: Fetch File Details from ContentDocument
            const contentDocumentQuery = `SELECT Id, Title, FileType, LatestPublishedVersionId 
                FROM ContentDocument 
                WHERE Id IN (${documentIds.map(id => `'${id}'`).join(',')})`;

            let contentResponse = await axios.get(`${instance_url}/services/data/v52.0/query?q=${encodeURIComponent(contentDocumentQuery)}`, {
                headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' }
            });

            let contentDocuments = contentResponse.data.records;
            console.log("contentDocuments", contentDocuments);
            // Step 3: Fetch File Data from ContentVersion
            for (let doc of contentDocuments) {
                const contentVersionQuery = `SELECT Id, Title, VersionData 
                    FROM ContentVersion 
                    WHERE Id = '${doc.LatestPublishedVersionId}'`;

                let versionResponse = await axios.get(`${instance_url}/services/data/v52.0/query?q=${encodeURIComponent(contentVersionQuery)}`, {
                    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' }
                });
// console.log("versionResponse", versionResponse);
                let versionData = versionResponse.data.records[0];
                console.log("versionData", versionData);
                if (versionData) {
                    doc.VersionData = versionData.VersionData;
                }
            }

            allDocumentsAndFiles = allDocumentsAndFiles.concat(contentDocuments);
            console.log("allDocumentsAndFiles", allDocumentsAndFiles);
            console.log(`Fetched ${contentDocuments.length} documents and files for Opportunity ID: ${opportunityId}`);
        }

        console.log('Combined Results:', allDocumentsAndFiles);
        return allDocumentsAndFiles;

    } catch (error) {
        console.error("Error fetching documents and files:", error.response ? error.response.data : error.message);
        return [];
    }
}





//function to fetch company(account)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
