import fetch from "node-fetch";
import { chromium } from "playwright";
import { setTimeout } from "timers/promises";
import { test } from "uvu";
import * as assert from "uvu/assert";

let browser;
let context;
let page;

const initialState = {
  Backlog: [
    {
      id: "task5",
      name: "Deploy application",
    },
  ],
  "In Progress": [
    {
      id: "task4",
      name: "Test application",
    },
  ],
  "In Review": [
    {
      id: "task6",
      name: "Build Application",
    },
  ],
  Done: [
    {
      id: "task2",
      name: "Design mockups",
    },
    {
      id: "task1",
      name: "Write specs",
    },
  ],
};

test.before(async () => {
  browser = await chromium.launch({
    use: { timezoneId: "Etc/UTC" },
  });
  context = await browser.newContext({
    recordVideo: { dir: "videos/" },
  });
  context.tracing.start({ screenshots: true, snapshots: true });
});

test.before.each(async () => {
  page = await context.newPage();
  await fetch("http://localhost:3001/tasks", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(initialState),
  });
  await showMousePosition(page);
});

test.after.each(async () => {
  await page.evaluate(() => window.localStorage.clear());
  await page.close();
  await context.tracing.stop({ path: "trace.zip" });
});

test.after(async () => {
  await browser.close();
  await context.close();
});

test("Solved Issue #1: The tasks aren't fetched from the server.", async () => {
  await page.goto("http://localhost:3000");
  await setTimeout(1000);

  const tasks = await page.$$eval("li", (tasks) => tasks.map((task) => task.textContent));
  const expectedTasks = [
    "Deploy application",
    "Test application",
    "Build Application",
    "Design mockups",
    "Write specs",
  ];

  tasks.sort();
  expectedTasks.sort();
  assert.equal(tasks, expectedTasks, "Tasks fetched from server do not match the expected tasks");
});

test("Solved Issue #2: The application doesn't handle the onDragStart, onDragOver, onDrop, and onDragEnd events.", async () => {
  await page.goto("http://localhost:3000");
  await setTimeout(1000);

  const taskToDrag = await page.$('li:has-text("Test application")');
  const dropTarget = await page.getByText("In Review");

  const taskToDragBoundingBox = await taskToDrag.boundingBox();
  const dropTargetBoundingBox = await dropTarget.boundingBox();

  await page.mouse.move(
    taskToDragBoundingBox.x + taskToDragBoundingBox.width / 2,
    taskToDragBoundingBox.y + taskToDragBoundingBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    dropTargetBoundingBox.x + dropTargetBoundingBox.width / 2,
    dropTargetBoundingBox.y + dropTargetBoundingBox.height / 2
  );

  await page.mouse.up();

  const tasks = await page.$$eval("li", (tasks) => tasks.map((task) => task.textContent));
  const expectedTasks = [
    "Deploy application",
    "Build Application",
    "Test application",
    "Design mockups",
    "Write specs",
  ];

  assert.equal(tasks, expectedTasks, "Tasks fetched from server do not match the expected tasks");
});

test("Solved Issue #2.1: Make sure the application doesn't incorrectly show duplicate tasks when dragged over themselves.", async () => {
  await page.goto("http://localhost:3000");
  await setTimeout(1000);

  const taskToDrag = await page.$('li:has-text("Test application")');
  const taskToDragBoundingBox = await taskToDrag.boundingBox();

  await page.mouse.move(
    taskToDragBoundingBox.x + taskToDragBoundingBox.width / 2,
    taskToDragBoundingBox.y + taskToDragBoundingBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    taskToDragBoundingBox.x + taskToDragBoundingBox.width / 2,
    taskToDragBoundingBox.y + taskToDragBoundingBox.height + 20
  );
  await page.mouse.move(
    taskToDragBoundingBox.x + taskToDragBoundingBox.width / 2,
    taskToDragBoundingBox.y + taskToDragBoundingBox.height + 20
  );

  await setTimeout(1000);
  const tasks = await page.$$eval("li", (tasks) => tasks.map((task) => task.textContent));
  const duplicateTaskCount = tasks.filter((task) => task === "Test application").length;
  assert.is(duplicateTaskCount, 1, "Duplicate tasks are shown when a task is dragged over itself.");
});

// test("Solved Issue #2.2: Make sure the application doesn't leave a lingering task when dragged over a column but dropped elsewhere.", async () => {
//   await page.goto("http://localhost:3000");
//   await setTimeout(1000);

//   const taskToDrag = await page.$('li:has-text("Test application")');
//   const dropTarget = await page.getByText("Build Application");
//   const elsewhere = await page.getByText("Codebase Mentor Kanban Board");

//   await taskToDrag.hover();
//   await page.mouse.down();
//   await setTimeout(1000);
//   await dropTarget.hover();
//   await dropTarget.hover();
//   await setTimeout(1000);
//   await elsewhere.hover();
//   await elsewhere.hover();
//   await setTimeout(1000);
//   await page.mouse.up();

//   const tasks = await page.$$eval("li", (tasks) => tasks.map((task) => task.textContent));

//   const duplicateTaskCount = tasks.filter((task) => task === "Test application").length;

//   assert.is(
//     duplicateTaskCount,
//     1,
//     "A lingering task is left when a task is dragged over a column but dropped elsewhere."
//   );
// });

test("Solved Issue #2: Make sure the application doesn't delete a task that is dragged over its current column.", async () => {
  await page.goto("http://localhost:3000");
  await setTimeout(1000);

  const taskToDrag = await page.$('li:has-text("Test application")');
  const dropTarget = await page.getByText("In Progress");

  const taskToDragBoundingBox = await taskToDrag.boundingBox();
  const dropTargetBoundingBox = await dropTarget.boundingBox();

  await page.mouse.move(
    taskToDragBoundingBox.x + taskToDragBoundingBox.width / 2,
    taskToDragBoundingBox.y + taskToDragBoundingBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    dropTargetBoundingBox.x + dropTargetBoundingBox.width / 2,
    dropTargetBoundingBox.y + dropTargetBoundingBox.height / 2
  );
  await page.mouse.up();
  await setTimeout(1000);

  const tasks = await page.$$eval("li", (tasks) => tasks.map((task) => task.textContent));

  assert.ok(
    tasks.includes("Test application"),
    "The application deletes a task that is dragged over its current column."
  );
});

test("Solved Issue #3: Task changes aren't being sent to the server.", async () => {
  await page.goto("http://localhost:3000");
  await setTimeout(1000);

  // Drag card from "In Progress" to "In Review"
  const taskToDrag = await page.$('li:has-text("Test application")');
  const dropTarget = await page.getByText("In Review");

  const taskToDragBoundingBox = await taskToDrag.boundingBox();
  const dropTargetBoundingBox = await dropTarget.boundingBox();

  await page.mouse.move(
    taskToDragBoundingBox.x + taskToDragBoundingBox.width / 2,
    taskToDragBoundingBox.y + taskToDragBoundingBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    dropTargetBoundingBox.x + dropTargetBoundingBox.width / 2,
    dropTargetBoundingBox.y + dropTargetBoundingBox.height / 2
  );

  await page.mouse.up();

  // Refresh the page
  await page.reload();

  const inReviewTasks = await page.$eval('div:has-text("In Review")', (column) =>
    Array.from(column.querySelectorAll("li")).map((task) => task.textContent)
  );

  // Check if the changes were made on the client side
  assert.ok(inReviewTasks.includes("Test application"), "Task changes were not persisted on the client side");

  // Fetch the server state
  const serverState = await fetch("http://localhost:3001/tasks").then((response) => response.json());

  // Check if the changes were made on the server side
  const inReviewTasksServer = serverState["In Review"].map((task) => task.name);
  assert.ok(inReviewTasksServer.includes("Test application"), "Task changes were not persisted to the server");
});

async function showMousePosition(page) {
  if (!page) {
    throw new Error("Cannot show mouse position because no browser has been launched");
  }
  // code from https://gist.github.com/aslushnikov/94108a4094532c7752135c42e12a00eb
  await page.addInitScript(() => {
    // Install mouse helper only for top-level frame.
    if (window !== window.parent) return;
    window.addEventListener(
      "DOMContentLoaded",
      () => {
        const box = document.createElement("playwright-mouse-pointer");
        const styleElement = document.createElement("style");
        styleElement.innerHTML = `
        playwright-mouse-pointer {
          pointer-events: none;
          position: absolute;
          top: 0;
          z-index: 10000;
          left: 0;
          width: 20px;
          height: 20px;
          background: rgba(0,0,0,.4);
          border: 1px solid white;
          border-radius: 10px;
          margin: -10px 0 0 -10px;
          padding: 0;
          transition: background .2s, border-radius .2s, border-color .2s;
        }
        playwright-mouse-pointer.button-1 {
          transition: none;
          background: rgba(0,0,0,0.9);
        }
        playwright-mouse-pointer.button-2 {
          transition: none;
          border-color: rgba(0,0,255,0.9);
        }
        playwright-mouse-pointer.button-3 {
          transition: none;
          border-radius: 4px;
        }
        playwright-mouse-pointer.button-4 {
          transition: none;
          border-color: rgba(255,0,0,0.9);
        }
        playwright-mouse-pointer.button-5 {
          transition: none;
          border-color: rgba(0,255,0,0.9);
        }
      `;
        document.head.appendChild(styleElement);
        document.body.appendChild(box);
        document.addEventListener(
          "mousemove",
          (event) => {
            box.style.left = event.pageX + "px";
            box.style.top = event.pageY + "px";
          },
          true
        );
        document.addEventListener(
          "mousedown",
          (event) => {
            box.classList.add("button-" + event.which);
          },
          true
        );
        document.addEventListener(
          "mouseup",
          (event) => {
            box.classList.remove("button-" + event.which);
          },
          true
        );
      },
      false
    );
  });
}

test.run();
