require("dotenv").config();
const axios = require("axios");
const express = require("express");
const path = require("path");
const fs = require("fs");
const FormData = require("form-data");

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
const access_token = '00D2v000002GS7P!AQEAQGVDSsD2DlqHVYMJn3tLDVAGi.r00pVYyW78FvX7bjB40IouJE8fE7mQkKew7hdjHCbaOn.7h2ZMiLUVG6ZvtnepA7IK';
const instance_url = 'https://d2v000002gs7peaw.my.salesforce.com'
const hsHelpers = require('./hshelpers.js');


app.get("/fetch-leads", async (req, res) => {
  try {
    // by using csv or json 
    const filePath = require("path").join(__dirname, "files", "Lead.json");
    // console.log("filePath:", filePath);
    const datas = await hsHelpers.readDataFromJson(filePath);  // Await the file reading function
    // console.log("datas", datas);
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
    hsHelpers.syncCompanyData(accounts);
    res.status(201).json({ message: "Accounts data synced successfully", error: null })
  } catch (error) {
    console.error("Error syncing accounts data:", error.message)
    res.status(500).json({
      message: "Error syncing accounts data",
      error: error.message,
    })
  }
})
app.get("/fetch-opportunity", async (req, res) => {
  try {
    const filePath = require("path").join(__dirname, "files", "Opportunity.json");
    const datas = await hsHelpers.readDataFromJson(filePath);
    console.log("datas", datas)
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

        // console.log("contactExists", response.data.results);
        console.log("contactId", contactId);
        console.log("ObjectId", ObjectId);

        if (contactExists) {
          const innerFiles = fs.readdirSync(fullPath);
          console.log(`  Files inside ${file}:`, innerFiles);

          for (const innerFile of innerFiles) {
            let noteContent = fs.readFileSync(path.join(fullPath, innerFile), "utf8");

            noteContent = `**Chatter** - ${noteContent.trim()}`;

            console.log("Updated noteContent:", noteContent);
            await hsHelpers.createNoteInHubSpot(ObjectId, noteContent, 'contactIds');
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
    const files = fs.readdirSync(folderPath).slice(0, 201);
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
            const chatterContent = `**Chatter** - ${noteContent.trim()}`;
            console.log("Updated noteContent:", chatterContent);
            await hsHelpers.createNoteInHubSpot(ObjectId, chatterContent, 'companyIds'); // Sync notes to company
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
    const files = fs.readdirSync(folderPath).slice(0, 1000);
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
            const chatterContent = `**Chatter** - ${noteContent.trim()}`;
            console.log("Updated noteContent:", chatterContent);
            await hsHelpers.createNoteInHubSpot(ObjectId, chatterContent, 'dealIds'); // Sync notes to deal
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
app.get("/fetch-lead-notes", async (req, res) => {
  const folderPath = path.join(__dirname, "files", "Lead+Notes+Documents");
  console.log("folderPath", folderPath);
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
        console.log("contactExists", response.data.results);
        const ObjectId = response.data.results[0]?.id;

        console.log("contactExists", response.data.results);
        console.log("contactId", contactId);
        console.log("ObjectId", ObjectId);

        if (contactExists) {
          const innerFiles = fs.readdirSync(fullPath);
          console.log(`Files inside ${file}:`, innerFiles);

          for (const innerFile of innerFiles) {
            let noteContent = fs.readFileSync(path.join(fullPath, innerFile), "utf8");

            noteContent = `**Notes** - ${noteContent.trim()}`;

            console.log("Updated noteContent:", noteContent);
            await hsHelpers.createNoteInHubSpot(ObjectId, noteContent, 'contactIds');
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
app.get("/fetch-account-notes", async (req, res) => {
  const folderPath = path.join(__dirname, "files", "Account+Notes+Documents");

  try {
    const files = fs.readdirSync(folderPath).slice(0, 201);
    console.log("Files and Folders inside:", folderPath);

    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        console.log("Folder (CompanyId):", file);
        const companyId = file.trim(); // Ensure no extra spaces
        console.log("CompanyId:", companyId);

        // 🔍 Search for the company in HubSpot using Salesforce Account ID
        const url = `https://api.hubapi.com/crm/v3/objects/companies/search`;
        const data = {
          filterGroups: [
            {
              filters: [{ propertyName: "sf_account_id", operator: "EQ", value: companyId }],
            },
          ],
        };

        try {
          const response = await axios.post(url, data, {
            headers: {
              Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
          });

          const companyExists = response.data.results.length > 0;
          const ObjectId = response.data.results[0]?.id || null;

          console.log("companyExists", response.data.results);
          console.log("CompanyId:", companyId);
          console.log("ObjectId:", ObjectId);

          if (companyExists && ObjectId) {
            const innerFiles = fs.readdirSync(fullPath);
            console.log(`  Files inside ${file}:`, innerFiles);

            for (const innerFile of innerFiles) {
              const innerFilePath = path.join(fullPath, innerFile);
              const innerFileStats = fs.statSync(innerFilePath);

              if (innerFileStats.isFile()) {
                const noteContent = fs.readFileSync(innerFilePath, "utf8");
                const chatterContent = `**Notes** - ${noteContent.trim()}`;
                console.log("Updated noteContent:", chatterContent);

                await hsHelpers.createNoteInHubSpot(ObjectId, chatterContent, "companyIds");
              } else {
                console.log("Skipping directory:", innerFile);
              }
            }
          } else {
            console.log(`Company ID ${companyId} not found in HubSpot`);
          }
        } catch (apiError) {
          console.error("Error searching for company in HubSpot:", apiError.response?.data || apiError.message);
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
app.get("/fetch-opportunity-notes", async (req, res) => {
  const folderPath = path.join(__dirname, "files", "Opportunity+Notes+Documents");

  try {
    if (!fs.existsSync(folderPath)) {
      console.error("Folder not found:", folderPath);
      return res.status(404).json({ error: "OpportunityChatter folder not found" });
    }

    const folders = fs.readdirSync(folderPath).slice(0, 300);
    for (const folder of folders) {
      const fullPath = path.join(folderPath, folder);
      if (!fs.statSync(fullPath).isDirectory()) {
        console.log("Skipping non-directory file:", folder);
        continue;
      }

      console.log("Processing Folder (OpportunityId):", folder);
      const opportunityId = folder.trim();

      // Searching for a Deal in HubSpot
      const url = "https://api.hubapi.com/crm/v3/objects/deals/search";
      const data = {
        filterGroups: [{ filters: [{ propertyName: "sf_opportunity_id", operator: "EQ", value: opportunityId }] }],
      };

      try {
        const response = await axios.post(url, data, {
          headers: {
            Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.data.results.length) {
          console.log("No deal found for OpportunityId:", opportunityId);
          continue;
        }

        const ObjectId = response.data.results[0].id;
        console.log("Deal Found in HubSpot | ObjectId:", ObjectId);

        const innerFiles = fs.readdirSync(fullPath);
        console.log(`Found ${innerFiles.length} files inside ${folder}`);

        let uploadedFileIds = [];
   
        for (const innerFile of innerFiles) {
          const innerFilePath = path.join(fullPath, innerFile);
          if (!fs.statSync(innerFilePath).isFile()) continue;

          const fileExt = path.extname(innerFilePath).toLowerCase();

          if (fileExt === ".snote") {
            const noteContent = fs.readFileSync(innerFilePath, "utf8").trim();
            console.log("Processing Note:", noteContent);

            // Add a bold prefix to the note content
            const noteContentWithPrefix = `**Note** - ${noteContent}`;

            // Create a note in HubSpot
            try {
              const noteResponse = await axios.post(
                "https://api.hubapi.com/crm/v3/objects/notes",
                {
                  properties: {
                    hs_note_body: noteContentWithPrefix,
                  },
                  associations: [
                    {
                      to: { id: ObjectId },
                      types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }],
                    },
                  ],
                },
                {
                  headers: {
                    Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              const noteId = noteResponse.data.id;
              console.log(`Note added to HubSpot | Note ID: ${noteId}`);
            } catch (noteError) {
              console.error("Error creating note:", noteError.response?.data || noteError.message);
            }
          }
           else {
            const allowedExts = [".pdf", ".jpg", ".png", ".csv"];
            if (allowedExts.includes(fileExt)) {
              console.log("Uploading attachment to HubSpot:", innerFile);
              const FormData = require("form-data");
              const form = new FormData();
              const buffer = fs.createReadStream(innerFilePath);

              form.append("file", buffer, innerFile);
              form.append("options", JSON.stringify({ access: "PRIVATE" }));
              form.append("folderPath", "/");

              try {
                const uploadResponse = await axios.post(
                  `https://api.hubapi.com/files/v3/files`,
                  form,
                  {
                    headers: {
                      Authorization: `Bearer ${DESTINATION_ACCESS_TOKEN}`,
                      ...form.getHeaders(),
                    },
                  }
                );
                const uploadedFileId = uploadResponse.data.id;
                console.log("Attachment uploaded to HubSpot | File ID:", uploadedFileId);

                uploadedFileIds.push(uploadedFileId);

              } catch (apiError) {
                console.error("HubSpot API Error:", apiError.response?.data || apiError.message);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error processing opportunity notes:", error.message);
        return res.status(500).json({ error: "Failed to process opportunity notes" });
      }
    }
    res.json({ message: "Successfully processed opportunity notes and documents" });
  } catch (error) {
    console.error("Error processing request:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});


//function to fetch company(account)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
