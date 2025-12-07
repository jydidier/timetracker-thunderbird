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

        updateFrequencyField.value = updateFrequency;

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

    let id = "null";
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
};

saveTaskButton.addEventListener('click', saveTask);


/* board display */
let getElapsedTime  = async(task) => {
    //item.due = (new Date(dueDate)).toISOString(); 
    let duration = 0;

    task.timeSlices.forEach((item) => {
        duration += new Date(item.due) - new Date(item.dtstart);
    });
    
    task.children.forEach((item) => {
        duration += getElapsedTime(item);
    });

    return duration;
};

let startStopEvent = async(evt) => {
    let source = evt.target;
    console.log(source);
    let id = source.dataset.event;

    source.classList.toggle("bi-play-fill");
    source.classList.toggle("bi-stop-fill");

    evt.preventDefault();
};

let addSubTask = async(evt) => {

    evt.preventDefault();
};

let deleteTask = async(evt) => {


    evt.preventDefault();
}



let processMap = async(map, elt) => {
    map.forEach((v,k) => {
        let details = document.createElement("ul");
        details.classList.add('list-group');
        let summary = document.createElement("li");
        summary.classList.add('list-group-item','d-flex','justify-content-between','align-items-start');

        details.id = `details-${k}`;
        summary.insertAdjacentHTML("beforeend",`
                    ${v.summary}

                    <span>
                    <a class="bi-play-fill data-event="${k}" id="play-${k}"></a>
                    <a class="bi-trash3-fill" data-event="${k}" id="delete-${k}"></a>
                    <a class="bi-plus-lg" data-event="${k}" id="add-${k}"></a>
                    </span>
        `
        );
        details.appendChild(summary);
        summary.querySelector(`#play-${k}`).addEventListener("click",startStopEvent);



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

let populateTasks = async () => {
    if (calendarId === null) return;
    let items = await mc.items.query({
        type: "task", 
        returnFormat: "jcal",
        calendarId
    });
    let todoStack = [];
    console.log(items);

    items.forEach(item => {
        let todo = asTodo(item);
        console.log(todo);
        todo.children = new Map();
        todo.timeSlices = new Map();

        tasks.set(todo.uid, todo);

        if (todo.relatedTo) {
            todoStack.push(todo);
        } else {
            taskTree.set(todo.uid, todo);
        }

        todoStack.forEach(elt => {
            if (elt.has(elt.relatedTo)) {
                if (elt.status === 'NEEDS-ACTION') {
                    tasks.get(elt.relateTo).children.set(elt.uid, elt);
                } else {
                    tasks.get(elt.relatedTo).timeSlice.set(elt.uid, elt);
                }
            }        
        });
    });


};

updateFrequency = await getStorage("timetracker-update-frequency") ?? {};
calendarId = await getStorage("timetracker-calendar") ?? {};

await populateTasks();
updateBoard();

if (globalThis.messenger !== undefined) {
    mc.items.onCreated.addListener(populateTasks);
    mc.items.onUpdated.addListener(populateTasks);
    mc.items.onRemoved.addListener(populateTasks);
} else {
    mc.items.addEventListener("created",populateTasks);
    mc.items.addEventListener("updated",populateTasks);
    mc.items.addEventListener("removed",populateTasks);
}