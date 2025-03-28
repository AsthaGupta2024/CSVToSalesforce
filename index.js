require("dotenv").config();
const axios = require("axios");
const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();
app.use(express.json());

// Salesforce OAuth credentials
const DESTINATION_ACCESS_TOKEN = process.env.DESTINATION_ACCESS_TOKEN;
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
    const filePath = require("path").join(__dirname, "files", "Lead.json");
    console.log("filePath:", filePath);
    const datas = await hsHelpers.readDataFromJson(filePath);  // Await the file reading function
   console.log("datas",datas);
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


app.get("/fetch-account", async (req, res) => {
  try {
    const filePath = require("path").join(__dirname, "files", "accounts.json");
    const accounts = await hsHelpers.readDataFromJson(filePath);    
    hsHelpers.syncCompanyData(accounts)
    
    // const data = await fetchAllCompanys(access_token, instance_url);
    // const getNotes = await processNotes(data,access_token, instance_url);

    res.status(201).json({ message: "Accounts data synced successfully", error: null})
  } catch (error) {
    console.error("Error syncing accounts data:", error.message)
    res.status(500).json({
      message: "Error syncing accounts data",
      error: error.message,
    })
  }
})

//endpoint to get  deal(opportunity)
app.get("/fetch-opportunity", async (req, res) => {
  try {
    const filePath = require("path").join(__dirname, "files", "Opportunity.json");
    const datas = await hsHelpers.readDataFromJson(filePath); 
    console.log("datas",datas)
    const processedContacts1 = await hsHelpers.syncDealData(datas);    // const getNotes = await processNotes(data,access_token, instance_url);
    // console.log("getNotes",getNotes);
    // const getEmail = await processEmail(data, access_token, instance_url);
    // const getFiles = await fetchOpportunityDocumentAndFile(data, access_token, instance_url);
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

app.get("/fetch-lead-chatters", async (req, res) => {
  const folderPath = path.join(__dirname, "files", "LeadChatters");

  try {
    const files = fs.readdirSync(folderPath).slice(0, 6);
    console.log("Files and Folders inside:", folderPath);

    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        console.log("Folder (ContactId):", file);
        const contactId = file; // Folder name is the Salesforce contactId
        console.log("ContactId:", contactId);


        const url = `https://api.hubapi.com/crm/v3/objects/contacts/search`;
        const data = {
          filterGroups: [
            {
              filters: [{ propertyName: "sf_lead_id", operator: "EQ", value: contactId }],
            },
          ],
        };

        const response = await axios.post(url, data, {
          headers: {
            Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        });

        const contactExists = response.data.results.length > 0;
        const ObjectId = response.data.results[0]?.id;

        console.log("contactExists",response.data.results);
        console.log("contactId", contactId);
        console.log("ObjectId", ObjectId);
        if (contactExists) {
          const innerFiles = fs.readdirSync(fullPath);
          console.log(`  Files inside ${file}:`, innerFiles);

          for (const innerFile of innerFiles) {
            const noteContent = fs.readFileSync(path.join(fullPath, innerFile), "utf8");
            console.log("noteContent", noteContent);
            await hsHelpers.createNoteInHubSpot(ObjectId, noteContent,'contactIds');
          }
        } else {
          console.log(`Contact ID ${ObjectId} not found in HubSpot`);
        }
      } else {
        console.log("Skipping file:", file);
      }
    }
    res.json({ message: "Successfully processed opportunity chatter files" });
  } catch (error) {
    console.error("Error processing opportunity chatter files:", error.message);
  }
});

app.get("/fetch-account-chatters", async (req, res) => {
  const folderPath = path.join(__dirname, "files", "AccountChatters");

  try {
    const files = fs.readdirSync(folderPath).slice(0, 6);
    console.log("Files and Folders inside:", folderPath);

    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        console.log("Folder (CompanyId):", file);
        const companyId = file; // Folder name is the Salesforce Account (Company) ID
        console.log("CompanyId:", companyId);

        // Search HubSpot for the company using Salesforce Account ID
        const url = `https://api.hubapi.com/crm/v3/objects/companies/search`;
        const data = {
          filterGroups: [
            {
              filters: [{ propertyName: "sf_account_id", operator: "EQ", value: companyId }],
            },
          ],
        };

        const response = await axios.post(url, data, {
          headers: {
            Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        });

        const companyExists = response.data.results.length > 0;
        const ObjectId = response.data.results[0]?.id;

        console.log("companyExists", response.data.results);
        console.log("CompanyId", companyId);
        console.log("ObjectId", ObjectId);

        if (companyExists) {
          const innerFiles = fs.readdirSync(fullPath);
          console.log(`  Files inside ${file}:`, innerFiles);

          for (const innerFile of innerFiles) {
            const noteContent = fs.readFileSync(path.join(fullPath, innerFile), "utf8");
            console.log("noteContent", noteContent);
            await hsHelpers.createNoteInHubSpot(ObjectId, noteContent, 'companyIds'); // Sync notes to company
          }
        } else {
          console.log(`Company ID ${ObjectId} not found in HubSpot`);
        }
      } else {
        console.log("Skipping file:", file);
      }
    }

    res.json({ message: "Successfully processed account chatter files" });
  } catch (error) {
    console.error("Error processing account chatter files:", error.message);
  }
});

app.get("/fetch-opportunity-chatters", async (req, res) => {
  const folderPath = path.join(__dirname, "files", "OpportunityChatters");

  try {
    const files = fs.readdirSync(folderPath).slice(0, 6);
    console.log("Files and Folders inside:", folderPath);

    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        console.log("Folder (DealId):", file);
        const dealId = file; // Folder name is the Salesforce Deal ID
        console.log("DealId:", dealId);

        // Search HubSpot for the deal using Salesforce Opportunity ID
        const url = `https://api.hubapi.com/crm/v3/objects/deals/search`;
        const data = {
          filterGroups: [
            {
              filters: [{ propertyName: "sf_opportunity_id", operator: "EQ", value: dealId }],
            },
          ],
        };

        const response = await axios.post(url, data, {
          headers: {
            Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        });

        const dealExists = response.data.results.length > 0;
        const ObjectId = response.data.results[0]?.id;

        console.log("dealExists", response.data.results);
        console.log("DealId", dealId);
        console.log("ObjectId", ObjectId);

        if (dealExists) {
          const innerFiles = fs.readdirSync(fullPath);
          console.log(`  Files inside ${file}:`, innerFiles);

          for (const innerFile of innerFiles) {
            const noteContent = fs.readFileSync(path.join(fullPath, innerFile), "utf8");
            console.log("noteContent", noteContent);
            await hsHelpers.createNoteInHubSpot(ObjectId, noteContent, 'dealIds'); // Sync notes to deal
          }
        } else {
          console.log(`Deal ID ${ObjectId} not found in HubSpot`);
        }
      } else {
        console.log("Skipping file:", file);
      }
    }

    res.json({ message: "Successfully processed deal chatter files" });
  } catch (error) {
    console.error("Error processing deal chatter files:", error.message);
  }
});







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
