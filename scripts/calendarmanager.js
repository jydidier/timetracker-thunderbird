const mc = (globalThis.messenger !== undefined) ?
    messenger.calendar:(await import('./calendar_front.js'));

class CalendarManager {
    #id = null;

    constructor(id) {
        this.#id = id;
    }

    setId(id) {
        this.#id = id;
    }

    async getCalendars(capability) {
        return await mc.calendars.query(capability);
    }

    async getTasks() {
        return await mc.items.query({
                type: "task", 
                returnFormat: "jcal",
                calendarId: this.#id
            });
    }

    async createTask(task) {
        let result = await mc.items.create(this.#id, {
            type: 'task', format: 'jcal', item: task.data
        });
        return result.id;    
    }

    async updateTask(task) {
        await mc.items.update(this.#id, task.uid, {
                format: 'jcal', 
                item: task.data
            });
    }

    async deleteTask(task) {
        await mc.items.delete(this.#id, task.uid);
    }

    onCreated(callback) {
        if (globalThis.messenger !== undefined) 
            mc.items.onCreated.addListener(callback);
        else 
            mc.items.addEventListener("created", callback);
    }

    onUpdated(callback) {
        if (globalThis.messenger !== undefined) 
            mc.items.onUpdated.addListener(callback);
        else 
            mc.items.addEventListener("updated", callback);
    }
    onRemoved(callback) {
        if (globalThis.messenger !== undefined) 
            mc.items.onDeleted.addListener(callback);
        else 
            mc.items.addEventListener("removed", callback);
    }


};

export {CalendarManager};