const mc = (globalThis.messenger !== undefined) ?
    messenger.calendar:(await import('./calendar_front.js'));

class CalendarManager {
    #id = null;

    constructor(id) {
        this.#id = id;
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

    }
};