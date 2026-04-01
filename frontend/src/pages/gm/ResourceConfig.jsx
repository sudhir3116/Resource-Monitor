import React from "react";
import ResourceConfig from "../ResourceConfig";

/**
 * GM-specific Resource Configuration wrapper.
 * Reuses the Admin component but restricts the ability to add new resources.
 */
export default function GMResourceConfig() {
    return <ResourceConfig isGM={true} />;
}
