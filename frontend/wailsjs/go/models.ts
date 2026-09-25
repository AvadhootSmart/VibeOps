export namespace ask {
	
	export class Question {
	    id: string;
	    question: string;
	    header: string;
	    options: string[];
	    allowOther: boolean;
	    command?: string;
	
	    static createFrom(source: any = {}) {
	        return new Question(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.question = source["question"];
	        this.header = source["header"];
	        this.options = source["options"];
	        this.allowOther = source["allowOther"];
	        this.command = source["command"];
	    }
	}

}

export namespace connectors {
	
	export class Status {
	    name: string;
	    displayName: string;
	    installed: boolean;
	    checked: boolean;
	    authenticated: boolean;
	    version: string;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.displayName = source["displayName"];
	        this.installed = source["installed"];
	        this.checked = source["checked"];
	        this.authenticated = source["authenticated"];
	        this.version = source["version"];
	    }
	}

}

export namespace main {
	
	export class VersionInfo {
	    current: string;
	    latest: string;
	
	    static createFrom(source: any = {}) {
	        return new VersionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.current = source["current"];
	        this.latest = source["latest"];
	    }
	}

}

export namespace overview {
	
	export class App {
	    name: string;
	    provider: string;
	    kind: string;
	    domain: string;
	    status: string;
	    uptime: string;
	
	    static createFrom(source: any = {}) {
	        return new App(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.provider = source["provider"];
	        this.kind = source["kind"];
	        this.domain = source["domain"];
	        this.status = source["status"];
	        this.uptime = source["uptime"];
	    }
	}
	export class Data {
	    server: string;
	    summary: string;
	    insight: string;
	    apps: App[];
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Data(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.server = source["server"];
	        this.summary = source["summary"];
	        this.insight = source["insight"];
	        this.apps = this.convertValues(source["apps"], App);
	        this.updatedAt = source["updatedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace sessions {
	
	export class Session {
	    id: string;
	    name: string;
	    messages: string;
	    updated: number;
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.messages = source["messages"];
	        this.updated = source["updated"];
	    }
	}
	export class SessionMeta {
	    id: string;
	    name: string;
	    updated: number;
	
	    static createFrom(source: any = {}) {
	        return new SessionMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.updated = source["updated"];
	    }
	}

}

export namespace settings {
	
	export class Server {
	    id: string;
	    name: string;
	    ipAddress: string;
	    port: string;
	    user: string;
	    keyPath: string;
	
	    static createFrom(source: any = {}) {
	        return new Server(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.ipAddress = source["ipAddress"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.keyPath = source["keyPath"];
	    }
	}
	export class Config {
	    model: string;
	    agentModels: Record<string, string>;
	    provider: string;
	    servers: Server[];
	    hideToolCalls: boolean;
	    experimentalAck: string[];
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.model = source["model"];
	        this.agentModels = source["agentModels"];
	        this.provider = source["provider"];
	        this.servers = this.convertValues(source["servers"], Server);
	        this.hideToolCalls = source["hideToolCalls"];
	        this.experimentalAck = source["experimentalAck"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace shell {
	
	export class Status {
	    ready: boolean;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ready = source["ready"];
	        this.message = source["message"];
	    }
	}

}

export namespace skills {
	
	export class Skill {
	    name: string;
	    description: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new Skill(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.path = source["path"];
	    }
	}

}

export namespace tools {
	
	export class AgentStatus {
	    installed: boolean;
	    version: string;
	
	    static createFrom(source: any = {}) {
	        return new AgentStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.version = source["version"];
	    }
	}
	export class Model {
	    id: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new Model(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	    }
	}

}

