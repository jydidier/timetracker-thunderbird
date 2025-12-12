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
taskManager.setCalendarManager(calendarManager);

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

if (taskModal) {
    taskModal.addEventListener('show.bs.modal', async (event) => {
        let id = event.relatedTarget.dataset.event;
        let save = document.getElementById("saveTask");
        if (!id) {
            delete save.dataset.id;
        } else {
            save.dataset.event = id;
        }
        let parent = event.relatedTarget.dataset.parent;
        if (!parent) {
            delete save.dataset.parent;
        } else {
            save.dataset.parent = parent;
        }
        
        if (!id) {
            document.getElementById("taskTitle").value = "";
            document.getElementById("taskDescription").value = "";
        } else {
            let task = taskManager.getTask(id);
            if (task) {
                document.getElementById("taskTitle").value = task.summary;
                document.getElementById("taskDescription").value = task.description;
            }
        }
    });
}



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

    console.log(evt.target.dataset);

    //let source = evt.target;
    let id = evt.target.dataset.event;
    let parent = evt.target.dataset.parent;
    let item = taskManager.getTask(id);
    console.log({item});
    let properties = {
        summary: title,
        description,
        status: "NEEDS-ACTION",
        timeSlices: new Map(),
        children: new Map()
    };
    if (parent) {
        properties.relatedTo = parent;
        properties.xIcanbanParent = parent;
    }
    
    if (id) properties.uid = id;

    await taskManager.saveTask(item, properties );
    let modal = bootstrap.Modal.getInstance(document.getElementById("taskModal"));
    modal.hide();
    updateBoard();
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
    let duration = taskManager.getElapsedTime(id);
    displayElapsedTime(timeDisplay, duration);

    source.classList.toggle("bi-play-fill");
    source.classList.toggle("bi-stop-fill");
    source.classList.toggle("btn-outline-success");
    source.classList.toggle("btn-outline-danger");
    evt.preventDefault();
};


let addSubTask = async(evt) => {
    let source = evt.target;
    let id = source.dataset.event;



    evt.preventDefault();
};


let deleteTask = async(evt) => {
    console.log("deleteTask");
    let source = evt.target;
    let id = source.dataset.event;
    await taskManager.deleteTask(id);
    updateBoard();
    evt.preventDefault();
};


let processMap = async(map, elt) => {
    let details = document.createElement("ul");
    details.classList.add('task-list');
    map.forEach((v,k) => {
        let summary = document.createElement("li");
        //summary.classList.add('list-group-item', 'g-0', 'full-right');

        details.id = `details-${k}`;
        // we have to rework on this
        if (v.children && v.children.size === 0) {
            summary.insertAdjacentHTML("beforeend",`
                <span class="d-flex justify-content-between align-items-start g-0 full-right">
                            <div class="task-item">
                                <b>${v.summary}</b>
                                <br/>
                                <span id="duration-${k}" class="duration" data-event="${k}"></span>
                            </div>
                            <span>
                                <a class="${!v.running?'bi-play-fill':'bi-stop-fill'} btn btn-outline-success btn-sm" data-event="${k}" id="play-${k}"></a>
                                <a class="bi-pencil-fill btn btn-outline-primary btn-sm" data-event="${k}" id="edit-${k}" data-bs-toggle="modal" data-bs-target="#taskModal"></a>
                                <a class="bi-trash3-fill btn btn-outline-primary btn-sm" data-event="${k}" id="delete-${k}"></a>
                                <a class="bi-plus-lg btn btn-outline-primary btn-sm" data-parent="${k}" id="add-${k}" data-bs-toggle="modal" data-bs-target="#taskModal"></a>
                            </span>
                </span>
            `);
            summary.querySelector(`#play-${k}`).addEventListener("click",startStopEvent);
        } else {
            summary.insertAdjacentHTML("beforeend",`
                <span class="d-flex justify-content-between align-items-start g-0 full-right">

                        <div class="task-item">
                            <b>${v.summary}</b>
                            <br/>
                            <span id="duration-${k}" class="duration" data-event="${k}"></span>
                        </div>
                        <span>
                            <a class="bi-pencil-fill btn btn-outline-primary btn-sm" data-event="${k}" id="edit-${k}" data-bs-toggle="modal" data-bs-target="#taskModal"></a>
                            <a class="bi-trash3-fill btn btn-outline-primary btn-sm" data-event="${k}" id="delete-${k}"></a>
                            <a class="bi-plus-lg btn btn-outline-primary btn-sm" data-parent="${k}" id="add-${k}" data-bs-toggle="modal" data-bs-target="#taskModal"></a>
                        </span>
                </span>
            `);
        }

        details.appendChild(summary);
        summary.querySelector(`#delete-${k}`).addEventListener("click",deleteTask);
        //summary.querySelector(`#edit-${k}`).addEventListener("click",deleteTask);

        let timeDisplay = summary.querySelector(`#duration-${k}`);
        let duration = taskManager.getElapsedTime(k);
        displayElapsedTime(timeDisplay, duration);

        if (v.children.size > 0) {
            //let li = document.createElement("li");
            //details.appendChild(li);
            //summary.appendChild(document.createElement("br"));
            processMap(v.children, summary); //.querySelector(`#details-${k}`));
        }
        elt.appendChild(details);
    });
};

let updateBoard = () => {
    let taskList = document.getElementById("taskList");
    taskList.textContent = '';
    processMap(taskManager.getTaskMap(), taskList);
};

updateFrequency = await getStorage("timetracker-update-frequency") ?? "-1";
calendarId = await getStorage("timetracker-calendar") ?? null;

calendarManager.setId(calendarId);
await taskManager.refreshAllTasks();
taskManager.setUpdateFrequency(updateFrequency);

updateBoard();

// refreshing time
setInterval(() => {
    let elts = document.querySelectorAll('.duration');

    elts.forEach((elt) => {
        let duration = taskManager.getElapsedTime(elt.dataset.event);
        displayElapsedTime(elt, duration);
    });
},1000);


//refresh();
