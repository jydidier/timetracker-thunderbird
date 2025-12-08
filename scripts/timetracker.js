/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** TODO Organize extension in a more modular way */

import './i18n.js';

import * as JCAL from './jcal.js';
import {marked} from '../vendor/marked.esm.js';

let mc = (globalThis.messenger !== undefined) ?
    messenger.calendar:(await import('./calendar_front.js'));


let capability = {};
let calendarId = null;
let updateFrequency = -1;
let populateTasks = async () => {};

let tasks = new Map();
let taskTree = new Map();
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

const asTodo = (item) => {
    if (item.formats){
        const cmp = new JCAL.Component(item.formats.jcal);
        return cmp.first('vtodo');
    }
    if (item.format === 'jcal') {
        const cmp = new JCAL.Component(item.item);
        return cmp.first('vtodo');
    }
    return null;
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
        let calendars = await mc.calendars.query(capability);
        let calList = document.getElementById('calendarList');
        let calendarCapability = document.getElementById('calendarCapability');
        let updateFrequencyField = document.getElementById('updateFrequency');

        //updateFrequencyField.value = String(updateFrequency);

        document,querySelector(`#updateFrequency input[value="${updateFrequency}"]`).selected = true;

        populateCalendars(calendars, calList); 
        
        if (capability.tasksSupported) {
            calendarCapability.checked = true;
        } else {
            calendarCapability.checked = false;
        }

        calendarCapability.addEventListener('change', async (event) => {
            capability = event.target.checked ? {tasksSupported: true} : {};
            let calendars = await mc.calendars.query(capability);
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
        updateFrequencyField.value = updateFrequency;

        // in case of changes, we should 
        // 1/ stop all current task
        // 2/ reload all

        setStorage("timetracker-update-frequency", updateFrequency);
        setStorage("timetracker-calendar", calendarId);

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
    let id = "null"; //evt.target.dataset.event;
    let item = (id !== "null") ?
        asTodo(await mc.items.get(calendarId, id, { returnFormat: "jcal" })) :
        new JCAL.Todo();
    if (title !== item.summary)
        item.summary = title;
    if (description !== item.description)
        item.description = description;

    if (id !== "null") {
        item.uid = id;
        await mc.items.update(calendarId, id, {format: 'jcal', item: item.data});
    } else {
        item.type="task";
        await mc.items.create(calendarId, {type: 'task', format: 'jcal', item: item.data});
    }
    let modal = bootstrap.Modal.getInstance(document.getElementById("taskModal"));
    modal.hide();

    //await populateTasks();
};

saveTaskButton.addEventListener('click', saveTask);


/* board display */
let getElapsedTime  = (task) => {
    let duration = 0;

    task.timeSlices.forEach((item) => {
        if (item !== null) {
            console.log,(item.due, item.dtstart,new Date(item.due) - new Date(item.dtstart) );
            duration += new Date(item.due) - new Date(item.dtstart);
        }
    });
    
    task.children.forEach((item) => {
        if (item !== null)
            duration += getElapsedTime(item);
    });

    return duration;
};


let removeTask = async (task) => {
    task.timeSlices.forEach(async (item) => {
        await mc.items.remove(calendarId,item.uid);
    });
    task.children.forEach(async (item) => {
        await removeTask(item);
    });
};


let getDate = () => {
    let date = new Date();

    return String(date.getFullYear()).padStart(4,"0") + "-" +
        String(date.getMonth()).padStart(2,"0") + "-" +
        String(date.getDate()).padStart(2,"0") + "T" +
        String(date.getHours()).padStart(2,"0") + ":" +
        String(date.getMinutes()).padStart(2,"0") + ":" +
        String(date.getSeconds()).padStart(2,"0");
};

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
        let event = new JCAL.Todo();
        event.summary = tasks.get(id).summary;
        event.status = "IN-PROCESS";
        event.dtstart = getDate(); 
        event.due = getDate(); 

        event.xIcanbanParent = event.relatedTo = id;
        let result = await mc.items.create(calendarId, {
            type: 'task', format: 'jcal', item: event.data
        });
        event.uid = result.id;
        tasks.get(id).timeSlices.set(result.id, event);
        // TODO: schedule updates
    } else {
        // event update: does async do damageable things in timeSlices?
        let uid = '';
        tasks.get(id).timeSlices.forEach((v) => {
            if (v.status === "IN-PROCESS") {
                uid = v.uid;
            }
        });

        if (uid) {
            let event = tasks.get(uid);
            event.status = "COMPLETED";
            event.due = getDate(); 

            await mc.items.update(calendarId, uid, {
                format: 'jcal', 
                item: event.data
            });
        }
    }

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
    await removeTask(source);
    evt.preventDefault();
};


let processMap = async(map, elt) => {
    map.forEach((v,k) => {
        let details = document.createElement("ul");
        details.classList.add('list-group');
        let summary = document.createElement("li");
        summary.classList.add('list-group-item','d-flex','justify-content-between','align-items-start');

        details.id = `details-${k}`;
        summary.insertAdjacentHTML("beforeend",`
                    ${v.summary}
                    <span id="duration-${k}"></span>
                    <span>
                        <a class="bi-play-fill" data-event="${k}" id="play-${k}"></a>
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
    processMap(taskTree, taskList);
};

/* task loading */

populateTasks = async () => {
    console.log("populate tasks");
    if (calendarId === null) return;
    let items = await mc.items.query({
        type: "task", 
        returnFormat: "jcal",
        calendarId
    });
    let todoStack = [];
    taskTree.clear();
    tasks.clear();

    items.forEach(item => {
        let todo = asTodo(item);
        todo.children = new Map();
        todo.timeSlices = new Map();

        tasks.set(todo.uid, todo);

        // something is strange there, especially in case of synchronisation error
        if (todo.relatedTo || todo.xIcanbanParent) {
            todoStack.push(todo);
        } else {
            taskTree.set(todo.uid, todo);
        }

        todoStack.forEach(elt => {
            if (elt.relatedTo || elt.xIcanbanParent) {
                if (elt.status === 'NEEDS-ACTION') {
                    tasks.get(elt.relatedTo ?? elt.xIcanbanParent)
                        .children.set(elt.uid, elt);
                } else {
                    tasks.get(elt.relatedTo ?? elt.xIcanbanParent)
                        .timeSlices.set(elt.uid, elt);
                }
            }        
        });
    });
};

updateFrequency = await getStorage("timetracker-update-frequency") ?? {};
calendarId = await getStorage("timetracker-calendar") ?? {};

let refresh = async () => {
    await populateTasks();
    updateBoard();
};


let mock = async(item) => {
    console.log("mock",item);
};

refresh();

if (globalThis.messenger !== undefined) {
    mc.items.onCreated.addListener(populateTasks);
    //mc.items.onUpdated.addListener(populateTasks);
    mc.items.onRemoved.addListener(populateTasks);
} else {
    mc.items.addEventListener("created", populateTasks);
    mc.items.addEventListener("updated", populateTasks);
    mc.items.addEventListener("removed", populateTasks);
}
