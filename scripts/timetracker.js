/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** TODO Organize extension in a more modular way */

import './i18n.js';

import {marked} from '../vendor/marked.esm.js';
import {TaskManager} from './taskmanager.js'; 
import {CalendarManager} from './calendarmanager.js';


let capability = {};
let calendarId = null;
let updateFrequency = -1;

const calendarManager = new CalendarManager(calendarId);
const taskManager = new TaskManager();

let interval = null;


/* helper functions */
let setStorage = async (key, value) => {
    if( globalThis.browser !== undefined) {
        let obj = {};
        obj[key] = value;
        await browser.storage.local.set(obj);
    } else {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

let getStorage = async (key) => {
    if (globalThis.browser !== undefined) {
        let obj = await browser.storage.local.get(key);
        return obj[key];
    } else {
        return JSON.parse(localStorage.getItem(key));
    }
};


/* Modal setup for setting */
const settingsModal = document.getElementById('settingsModal');
const saveSettings = document.getElementById('saveSettings');


let populateCalendars = (calendars, filterList) => {
    filterList.textContent = "";
    calendars.sort( (a,b) => a.name.localeCompare(b.name) ).forEach(calendar => {
        let filterItem = document.createElement('div');
        filterItem.classList.add('form-check');
        filterItem.insertAdjacentHTML(
            'beforeend',
            DOMPurify.sanitize(`
                <input class="form-check-input" type="radio" value="${calendar.id}" name="calendar" id="filter-${calendar.id}" ${(calendarId && calendarId === calendar.id)?'checked':''}>
                <label class="form-check-label" for="filter-${calendar.id}">
                    <i class="bi bi-circle-fill" style="color:${calendar.color}"></i>
                    ${calendar.name}
                </label>
            `)
        );
        filterList.appendChild(filterItem);
    });
};

if (settingsModal) {
    settingsModal.addEventListener('show.bs.modal', async (event) => {
        let calendars = await calendarManager.getCalendars(capability);
        let calList = document.getElementById('calendarList');
        let calendarCapability = document.getElementById('calendarCapability');
        let updateFrequencyField = document.getElementById('updateFrequency');

        updateFrequencyField.value = String(updateFrequency);
        console.log({updateFrequency});
        document.querySelector(`#updateFrequency > option[value="${updateFrequency}"]`).selected = true;

        populateCalendars(calendars, calList); 
        
        if (capability.tasksSupported) {
            calendarCapability.checked = true;
        } else {
            calendarCapability.checked = false;
        }

        calendarCapability.addEventListener('change', async (event) => {
            capability = event.target.checked ? {tasksSupported: true} : {};
            let calendars = await calendarManager.getCalendars(capability);
            populateCalendars(calendars, calList);
        });
    });
}


if (saveSettings) {
    saveSettings.addEventListener('click', async (event) => {
        let calendarList = document.getElementById('calendarList');
        let calendarIds = [];
        calendarIds = Array.from(calendarList.querySelectorAll('input:checked')).map(input => input.value);
        calendarId = (calendarIds.length > 0)?calendarIds[0]:null;

        let updateFrequencyField = document.getElementById('updateFrequency');
        updateFrequency = updateFrequencyField.value;

        // in case of changes, we should 
        // 1/ stop all current task
        // 2/ reload all

        setStorage("timetracker-update-frequency", updateFrequency);
        setStorage("timetracker-calendar", calendarId);
        taskManager.setUpdateFrequency(updateFrequency);

        let modal = bootstrap.Modal.getInstance(document.getElementById("settingsModal"));
        modal.hide();    
    });
}



/* Modal setup for task edition */
const taskModal = document.getElementById('taskModal');
const saveTaskButton = document.getElementById('saveTask');

const saveTask = async (evt) => {
    //  here, we must add some controls
    let form = document.getElementById('taskForm');
    if (!form.checkValidity()) {
        evt.preventDefault();
        evt.stopPropagation();
        alert(browser.i18n.getMessage('alertTask'));
        return;
    }

    let title = document.getElementById('taskTitle').value;
    let description = document.getElementById('taskDescription').value;

    //let source = evt.target;
    let id = null; //evt.target.dataset.event;
    let item = taskManager.getTask(id);
    let properties = {
        summary: title,
        description
    };
    if (id) properties.uid = id;

    await taskManager.saveTask(item, properties );
    let modal = bootstrap.Modal.getInstance(document.getElementById("taskModal"));
    modal.hide();
};

saveTaskButton.addEventListener('click', saveTask);


let displayElapsedTime = (elt, value) => {
    // here, the value is in milliseconds
    let hh = ((value / 3600000) | 0);
    let mm = ((value / 1000 - hh*3600) / 60 | 0);
    let ss = ((value / 1000 - hh*3600 - mm*60) | 0 );

    elt.textContent = `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
};


let startStopEvent = async(evt) => {
    let source = evt.target;
    let id = source.dataset.event;

    if (source.classList.contains("bi-play-fill")) {
        await taskManager.startTask(id);
    } else {
        await taskManager.stopTask(id);
    }

    // this part should be elsewhere
    let timeDisplay = document.getElementById(`duration-${id}`);
    let duration = getElapsedTime(tasks.get(id));
    displayElapsedTime(timeDisplay, duration);

    source.classList.toggle("bi-play-fill");
    source.classList.toggle("bi-stop-fill");
    evt.preventDefault();
};


let addSubTask = async(evt) => {
    let source = evt.target;
    let id = source.dataset.event;

    evt.preventDefault();
};


let deleteTask = async(evt) => {
    let source = evt.target;
    let id = source.dataset.event;
    await taskManager.deleteTask(source);
    evt.preventDefault();
};


let processMap = async(map, elt) => {
    map.forEach((v,k) => {
        let details = document.createElement("ul");
        details.classList.add('list-group');
        let summary = document.createElement("li");
        summary.classList.add('list-group-item','d-flex','justify-content-between','align-items-start');

        details.id = `details-${k}`;
        // we have to rework on this
        summary.insertAdjacentHTML("beforeend",`
                    ${v.summary}
                    <span id="duration-${k}"></span>
                    <span>
                        <a class="${v.running?'bi-play-fill':'bi-stop-fill'}" data-event="${k}" id="play-${k}"></a>
                        <a class="bi-trash3-fill" data-event="${k}" id="delete-${k}"></a>
                        <a class="bi-plus-lg" data-event="${k}" id="add-${k}"></a>
                    </span>
        `);
        details.appendChild(summary);
        summary.querySelector(`#play-${k}`).addEventListener("click",startStopEvent);
        summary.querySelector(`#delete-${k}`).addEventListener("click",deleteTask);

        let timeDisplay = summary.querySelector(`#duration-${k}`);
        let duration = getElapsedTime(tasks.get(k));
        displayElapsedTime(timeDisplay, duration);

        if (v.children.size > 0) {
            processMap(v.children, details);
        }
        elt.appendChild(details);
    });
};

let updateBoard = async() => {
    let taskList = document.getElementById("taskList");
    taskList.textContent = '';
    processMap(taskManager.getTaskMap(), taskList);
};

updateFrequency = await getStorage("timetracker-update-frequency") ?? "-1";
calendarId = await getStorage("timetracker-calendar") ?? null;

calendarManager.setId(calendarId);
await taskManager.refreshAllTasks();
taskManager.setUpdateFrequency(updateFrequency);

let refresh = async () => {
    updateBoard();
};





refresh();
